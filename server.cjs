require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

let dbClient;
let db;

// Белый список персонала команды Mangal Lounge
const STAFF_MEMBERS = {
    '848502221': { name: 'Влада', role: 'waiter', title: 'Официант' },
    '5676195545': { name: 'Никита', role: 'hookah', title: 'Кальянный мастер' },
    '6804474400': { name: 'Дастан', role: 'manager', title: 'Менеджер' },
    '1787388463': { name: 'Полина', role: 'waiter', title: 'Официант' }
};

const DEFAULT_PRODUCTS = [
    { id: 1, name: 'Люля-кебаб (баранина)', category: 'Полуфабрикаты', stock: 8, price: 150000 },
    { id: 2, name: 'Стейк Рибай Premium', category: 'Мясо', stock: 3, price: 450000 },
    { id: 3, name: 'Пельмени фирменные', category: 'Заморозка', stock: 12, price: 120000 },
    { id: 4, name: 'Чизкейк Нью-Йорк', category: 'Десерты', stock: 5, price: 85000 }
];

async function initDB() {
    if (!MONGO_URI) {
        console.warn('MONGO_URI не задан!');
        return;
    }
    try {
        dbClient = new MongoClient(MONGO_URI);
        await dbClient.connect();
        db = dbClient.db('mangal_lounge');
        console.log('MongoDB подключена успешно!');

        const count = await db.collection('products').countDocuments();
        if (count === 0) {
            await db.collection('products').insertMany(DEFAULT_PRODUCTS);
        }
    } catch (e) {
        console.error('Ошибка подключения MongoDB:', e);
    }
}
initDB();

// Функция привязки реферала
async function linkReferral(guestId, referrerId, guestName) {
    if (!db || !guestId || !referrerId || guestId === referrerId) return false;

    const usersCol = db.collection('users');
    const guest = await usersCol.findOne({ id: guestId });
    if (guest && guest.referredBy) return false;

    const referrer = await usersCol.findOne({ id: referrerId });
    if (!referrer) {
        await usersCol.insertOne({
            id: referrerId,
            firstName: 'Друг',
            photoUrl: '',
            referredBy: null,
            bonusBalance: 400,
            level: 'Серебро',
            clientNotes: '',
            referrals: [{
                userId: guestId,
                name: guestName || 'Гость',
                joinedAt: new Date().toLocaleDateString('ru-RU'),
                earnedFromUser: 0
            }]
        });
    } else {
        const alreadyInList = (referrer.referrals || []).some(r => String(r.userId) === guestId);
        if (!alreadyInList) {
            await usersCol.updateOne(
                { id: referrerId },
                {
                    $inc: { bonusBalance: 100 },$push: {
                        referrals: {
                            userId: guestId,
                            name: guestName || (guest ? guest.firstName : 'Гость'),
                            joinedAt: new Date().toLocaleDateString('ru-RU'),
                            earnedFromUser: 0
                        }
                    }
                }
            );
        }
    }

    await usersCol.updateOne({ id: guestId }, { $set: { referredBy: referrerId } });
    return true;
}

// 1. Инициализация пользователя
app.post('/api/init-user', async (req, res) => {
    const { userId, firstName, photoUrl, startParam } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId обязателен' });

    const strId = String(userId).trim();
    const staffInfo = STAFF_MEMBERS[strId] || null;

    if (!db) return res.status(500).json({ error: 'База данных еще не готова' });

    const usersCol = db.collection('users');
    let user = await usersCol.findOne({ id: strId });

    if (!user) {
        user = {
            id: strId,
            firstName: firstName || (staffInfo ? staffInfo.name : 'Гость'),
            photoUrl: photoUrl || '',
            referredBy: null,
            bonusBalance: 300,
            level: 'Серебро',
            clientNotes: '',
            referrals: []
        };
        await usersCol.insertOne(user);
    } else {
        const updates = {};
        if (photoUrl && !user.photoUrl) updates.photoUrl = photoUrl;
        if (firstName && user.firstName === 'Гость') updates.firstName = firstName;
        if (Object.keys(updates).length > 0) {
            await usersCol.updateOne({ id: strId }, { $set: updates });
            user = { ...user, ...updates };
        }
    }

    if (startParam) {
        const refId = String(startParam).replace('ref_', '').trim();
        await linkReferral(strId, refId, firstName || user.firstName);
        user = await usersCol.findOne({ id: strId });
    }

    const tables = await db.collection('tables').find({}).toArray();
    const activeTables = {};
    tables.forEach(t => { activeTables[t.tableNum] = t; });

    const products = await db.collection('products').find({}).toArray();

    res.json({
        user,
        isStaff: Boolean(staffInfo),
        staffInfo,
        activeTables: staffInfo ? activeTables : undefined,
        products
    });
});

// 2. Ручной ввод кода друга
app.post('/api/user/apply-ref', async (req, res) => {
    const { userId, refCode } = req.body;
    const strId = String(userId).trim();
    const refId = String(refCode).replace('ref_', '').trim();

    if (!db) return res.status(500).json({ error: 'База данных не подключена' });
    const usersCol = db.collection('users');
    const user = await usersCol.findOne({ id: strId });

    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (strId === refId) return res.status(400).json({ error: 'Нельзя пригласить себя' });
    if (user.referredBy) return res.status(400).json({ error: 'Вы уже использовали код' });

    const ok = await linkReferral(strId, refId, user.firstName);
    if (ok) {
        const updated = await usersCol.findOne({ id: strId });
        res.json({ success: true, user: updated });
    } else {
        res.status(400).json({ error: 'Не удалось применить код' });
    }
});

// 3. Обновление имени
app.post('/api/user/update-name', async (req, res) => {
    const { userId, newName } = req.body;
    const strId = String(userId).trim();
    if (!db) return res.status(500).json({ error: 'База данных не подключена' });

    await db.collection('users').updateOne({ id: strId }, { $set: { firstName: newName } });
    const user = await db.collection('users').findOne({ id: strId });
    res.json({ success: true, user });
});

// 4. Инфо о клиенте по ID
app.get('/api/staff/client-info/:userId', async (req, res) => {
    const strId = String(req.params.userId).trim();
    if (!db) return res.status(500).json({ error: 'База данных не подключена' });

    let client = await db.collection('users').findOne({ id: strId });
    if (!client) {
        client = {
            id: strId,
            firstName: 'Новый гость',
            bonusBalance: 300,
            level: 'Серебро',
            clientNotes: ''
        };
    }
    res.json(client);
});

// 5. Посадить гостя за стол + сохранить постоянные заметки
app.post('/api/staff/open-table', async (req, res) => {
    const { tableNum, userId, notes, staffName } = req.body;
    const strId = String(userId).trim();
    if (!db) return res.status(500).json({ error: 'База данных не подключена' });

    if (notes) {
        await db.collection('users').updateOne({ id: strId }, { $set: { clientNotes: notes } });
    }

    const client = await db.collection('users').findOne({ id: strId }) || { firstName: 'Гость', level: 'Серебро' };

    const tableData = {
        tableNum,
        userId: strId,
        clientName: client.firstName,
        clientLevel: client.level || 'Серебро',
        notes: notes || '',
        staffName: staffName || 'Персонал',
        openedAt: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    };

    await db.collection('tables').updateOne({ tableNum }, { $set: tableData }, { upsert: true });

    const tables = await db.collection('tables').find({}).toArray();
    const activeTables = {};
    tables.forEach(t => { activeTables[t.tableNum] = t; });

    res.json({ success: true, activeTables });
});

// 6. Обновление заметок
app.post('/api/staff/update-client-notes', async (req, res) => {
    const { userId, notes, tableNum } = req.body;
    const strId = String(userId).trim();
    if (!db) return res.status(500).json({ error: 'База данных не подключена' });

    await db.collection('users').updateOne({ id: strId }, { $set: { clientNotes: notes } });
    if (tableNum) {
        await db.collection('tables').updateOne({ tableNum }, { $set: { notes } });
    }

    const tables = await db.collection('tables').find({}).toArray();
    const activeTables = {};
    tables.forEach(t => { activeTables[t.tableNum] = t; });

    res.json({ success: true, activeTables });
});

// 7. Закрытие стола с кешбэком 3% и 5% пригласившему
app.post('/api/staff/close-table', async (req, res) => {
    const { tableNum, orderTotal } = req.body;
    if (!db) return res.status(500).json({ error: 'База данных не подключена' });

    const table = await db.collection('tables').findOne({ tableNum });
    if (!table) return res.status(404).json({ error: 'Стол не найден' });

    const amount = Number(orderTotal) || 0;
    const cashback = Math.round(amount * 0.03);

    const client = await db.collection('users').findOne({ id: table.userId });
    if (client) {
        await db.collection('users').updateOne(
            { id: client.id },
            { $inc: { bonusBalance: cashback } }
        );

        if (client.referredBy) {
            const refBonus = Math.round(amount * 0.05);
            await db.collection('users').updateOne(
                { id: client.referredBy, "referrals.userId": client.id },
                {
                    $inc: {
                        bonusBalance: refBonus,
                        "referrals.$.earnedFromUser": refBonus
                    }
                }
            );
        }
    }

    await db.collection('tables').deleteOne({ tableNum });

    const tables = await db.collection('tables').find({}).toArray();
    const activeTables = {};
    tables.forEach(t => { activeTables[t.tableNum] = t; });

    res.json({ success: true, cashbackAwarded: cashback, activeTables });
});

// 8. Каталог Mr. Po
app.get('/api/products', async (req, res) => {
    if (!db) return res.json(DEFAULT_PRODUCTS);
    const products = await db.collection('products').find({}).toArray();
    res.json(products);
});

app.post('/api/products/add', async (req, res) => {
    const { name, category, stock, price } = req.body;
    const newProduct = {
        id: Date.now(),
        name,
        category: category || 'Мясо',
        stock: Number(stock) || 0,
        price: Number(price) || 0
    };
    await db.collection('products').insertOne(newProduct);
    const products = await db.collection('products').find({}).toArray();
    res.json({ success: true, products });
});

app.post('/api/products/update', async (req, res) => {
    const { id, name, category, stock, price } = req.body;
    await db.collection('products').updateOne(
        { id: Number(id) },
        {
            $set: {
                name,
                category,
                stock: Number(stock),
                price: Number(price)
            }
        }
    );
    const products = await db.collection('products').find({}).toArray();
    res.json({ success: true, products });
});

app.post('/api/products/delete', async (req, res) => {
    const { id } = req.body;
    await db.collection('products').deleteOne({ id: Number(id) });
    const products = await db.collection('products').find({}).toArray();
    res.json({ success: true, products });
});

app.listen(PORT, () => console.log(`Mangal Backend запущен на порту ${PORT}`));
