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
let db = null;

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

const fallbackMemory = {
    users: {},
    activeTables: {},
    products: DEFAULT_PRODUCTS
};

async function startServer() {
    if (MONGO_URI) {
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
            console.error('Ошибка подключения MongoDB:', e.message);
        }
    } else {
        console.warn('Предупреждение: MONGO_URI не найден в переменных среды!');
    }

    app.listen(PORT, () => console.log(`Mangal Backend запущен на порту ${PORT}`));
}

// Привязка реферала
async function linkReferral(guestId, referrerId, guestName) {
    if (!guestId || !referrerId || guestId === referrerId) return false;

    if (db) {
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
                    ordersCount: 0,
                    earnedFromUser: 0
                }]
            });
        } else {
            const alreadyInList = (referrer.referrals || []).some(r => String(r.userId) === guestId);
            if (!alreadyInList) {
                await usersCol.updateOne(
                    { id: referrerId },
                    {
                        $inc: { bonusBalance: 100 },
                        $push: {
                            referrals: {
                                userId: guestId,
                                name: guestName || (guest ? guest.firstName : 'Гость'),
                                joinedAt: new Date().toLocaleDateString('ru-RU'),
                                ordersCount: 0,
                                earnedFromUser: 0
                            }
                        }
                    }
                );
            }
        }

        await usersCol.updateOne({ id: guestId }, { $set: { referredBy: referrerId } }, { upsert: true });
        return true;
    } else {
        if (fallbackMemory.users[guestId]?.referredBy) return false;
        if (!fallbackMemory.users[referrerId]) {
            fallbackMemory.users[referrerId] = {
                id: referrerId,
                firstName: 'Друг',
                photoUrl: '',
                referredBy: null,
                bonusBalance: 400,
                level: 'Серебро',
                clientNotes: '',
                referrals: []
            };
        }
        fallbackMemory.users[referrerId].bonusBalance = (fallbackMemory.users[referrerId].bonusBalance || 0) + 100;
        fallbackMemory.users[referrerId].referrals = fallbackMemory.users[referrerId].referrals || [];
        fallbackMemory.users[referrerId].referrals.push({
            userId: guestId,
            name: guestName || 'Гость',
            joinedAt: new Date().toLocaleDateString('ru-RU'),
            ordersCount: 0,
            earnedFromUser: 0
        });
        if (fallbackMemory.users[guestId]) {
            fallbackMemory.users[guestId].referredBy = referrerId;
        }
        return true;
    }
}

// 1. Инициализация пользователя
app.post('/api/init-user', async (req, res) => {
    try {
        const { userId, firstName, photoUrl, startParam } = req.body;
        if (!userId) return res.status(400).json({ error: 'userId обязателен' });

        const strId = String(userId).trim();
        const staffInfo = STAFF_MEMBERS[strId] || null;

        let user = null;

        if (db) {
            const usersCol = db.collection('users');
            user = await usersCol.findOne({ id: strId });

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
                if (firstName && (user.firstName === 'Гость' || !user.firstName)) updates.firstName = firstName;
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

            return res.json({
                user,
                isStaff: Boolean(staffInfo),
                staffInfo,
                activeTables: staffInfo ? activeTables : undefined,
                products
            });
        } else {
            if (!fallbackMemory.users[strId]) {
                fallbackMemory.users[strId] = {
                    id: strId,
                    firstName: firstName || (staffInfo ? staffInfo.name : 'Гость'),
                    photoUrl: photoUrl || '',
                    referredBy: null,
                    bonusBalance: 300,
                    level: 'Серебро',
                    clientNotes: '',
                    referrals: []
                };
            }
            user = fallbackMemory.users[strId];
            if (startParam) {
                const refId = String(startParam).replace('ref_', '').trim();
                linkReferral(strId, refId, firstName);
            }
            return res.json({
                user,
                isStaff: Boolean(staffInfo),
                staffInfo,
                activeTables: staffInfo ? fallbackMemory.activeTables : undefined,
                products: fallbackMemory.products
            });
        }
    } catch (err) {
        console.error('Ошибка в /api/init-user:', err);
        res.status(500).json({ error: err.message });
    }
});

// 2. Ручная привязка реферала
app.post('/api/user/apply-ref', async (req, res) => {
    try {
        const { userId, refCode } = req.body;
        const strId = String(userId).trim();
        const refId = String(refCode).replace('ref_', '').trim();

        if (strId === refId) return res.status(400).json({ error: 'Нельзя пригласить себя' });

        if (db) {
            const usersCol = db.collection('users');
            const user = await usersCol.findOne({ id: strId });
            if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
            if (user.referredBy) return res.status(400).json({ error: 'Код уже активирован' });

            const ok = await linkReferral(strId, refId, user.firstName);
            if (ok) {
                const updated = await usersCol.findOne({ id: strId });
                return res.json({ success: true, user: updated });
            }
            return res.status(400).json({ error: 'Не удалось применить код' });
        } else {
            const user = fallbackMemory.users[strId];
            if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
            const ok = linkReferral(strId, refId, user.firstName);
            return res.json({ success: ok, user });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Обновление имени
app.post('/api/user/update-name', async (req, res) => {
    try {
        const { userId, newName } = req.body;
        const strId = String(userId).trim();

        if (db) {
            await db.collection('users').updateOne({ id: strId }, { $set: { firstName: newName } });
            const user = await db.collection('users').findOne({ id: strId });
            return res.json({ success: true, user });
        } else {
            if (fallbackMemory.users[strId]) {
                fallbackMemory.users[strId].firstName = newName;
                return res.json({ success: true, user: fallbackMemory.users[strId] });
            }
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Инфо о клиенте
app.get('/api/staff/client-info/:userId', async (req, res) => {
    try {
        const strId = String(req.params.userId).trim();
        let client = null;

        if (db) {
            client = await db.collection('users').findOne({ id: strId });
        } else {
            client = fallbackMemory.users[strId];
        }

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
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Посадить гостя за стол
app.post('/api/staff/open-table', async (req, res) => {
    try {
        const { tableNum, userId, notes, staffName } = req.body;
        const strId = String(userId).trim();

        if (db) {
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
            return res.json({ success: true, activeTables });
        } else {
            if (notes && fallbackMemory.users[strId]) fallbackMemory.users[strId].clientNotes = notes;
            const client = fallbackMemory.users[strId] || { firstName: 'Гость', level: 'Серебро' };
            fallbackMemory.activeTables[tableNum] = {
                tableNum,
                userId: strId,
                clientName: client.firstName,
                clientLevel: client.level || 'Серебро',
                notes: notes || '',
                staffName: staffName || 'Персонал',
                openedAt: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
            };
            return res.json({ success: true, activeTables: fallbackMemory.activeTables });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Обновить заметки
app.post('/api/staff/update-client-notes', async (req, res) => {
    try {
        const { userId, notes, tableNum } = req.body;
        const strId = String(userId).trim();

        if (db) {
            await db.collection('users').updateOne({ id: strId }, { $set: { clientNotes: notes } });
            if (tableNum) await db.collection('tables').updateOne({ tableNum }, { $set: { notes } });

            const tables = await db.collection('tables').find({}).toArray();
            const activeTables = {};
            tables.forEach(t => { activeTables[t.tableNum] = t; });
            return res.json({ success: true, activeTables });
        } else {
            if (fallbackMemory.users[strId]) fallbackMemory.users[strId].clientNotes = notes;
            if (tableNum && fallbackMemory.activeTables[tableNum]) fallbackMemory.activeTables[tableNum].notes = notes;
            return res.json({ success: true, activeTables: fallbackMemory.activeTables });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. ЗАКРЫТИЕ СТОЛА: Кешбэк гостю 3%, рефереру: 5% с 1-го заказа и 1% с последующих
app.post('/api/staff/close-table', async (req, res) => {
    try {
        const { tableNum, orderTotal } = req.body;
        const amount = Number(orderTotal) || 0;
        const cashback = Math.round(amount * 0.03);

        if (db) {
            const table = await db.collection('tables').findOne({ tableNum });
            if (!table) return res.status(404).json({ error: 'Стол не найден' });

            const client = await db.collection('users').findOne({ id: table.userId });
            if (client) {
                // Начисляем личный кешбэк 3% гостю
                await db.collection('users').updateOne(
                    { id: client.id },
                    { $inc: { bonusBalance: cashback } }
                );

                // Расчет реферального бонуса пригласившему
                if (client.referredBy) {
                    const referrer = await db.collection('users').findOne({ id: client.referredBy });
                    if (referrer && Array.isArray(referrer.referrals)) {
                        const refRecord = referrer.referrals.find(r => String(r.userId) === String(client.id));
                        const currentOrders = refRecord?.ordersCount || 0;
                        
                        // ПЕРВЫЙ ЗАКАЗ: 5%, ПОСЛЕДУЮЩИЕ: 1%
                        const rate = currentOrders === 0 ? 0.05 : 0.01;
                        const refBonus = Math.round(amount * rate);

                        await db.collection('users').updateOne(
                            { id: client.referredBy, "referrals.userId": client.id },
                            {
                                $inc: {
                                    bonusBalance: refBonus,
                                    "referrals.$.earnedFromUser": refBonus,
                                    "referrals.$.ordersCount": 1
                                }
                            }
                        );
                    }
                }
            }

            await db.collection('tables').deleteOne({ tableNum });
            const tables = await db.collection('tables').find({}).toArray();
            const activeTables = {};
            tables.forEach(t => { activeTables[t.tableNum] = t; });
            return res.json({ success: true, cashbackAwarded: cashback, activeTables });
        } else {
            // Фоллбэк в памяти
            const table = fallbackMemory.activeTables[tableNum];
            if (!table) return res.status(404).json({ error: 'Стол не найден' });

            const client = fallbackMemory.users[table.userId];
            if (client) {
                client.bonusBalance = (client.bonusBalance || 0) + cashback;
                if (client.referredBy && fallbackMemory.users[client.referredBy]) {
                    const referrer = fallbackMemory.users[client.referredBy];
                    referrer.referrals = referrer.referrals || [];
                    const refRecord = referrer.referrals.find(r => String(r.userId) === String(client.id));
                    
                    const currentOrders = refRecord?.ordersCount || 0;
                    const rate = currentOrders === 0 ? 0.05 : 0.01;
                    const refBonus = Math.round(amount * rate);

                    referrer.bonusBalance = (referrer.bonusBalance || 0) + refBonus;
                    if (refRecord) {
                        refRecord.earnedFromUser = (refRecord.earnedFromUser || 0) + refBonus;
                        refRecord.ordersCount = currentOrders + 1;
                    }
                }
            }

            delete fallbackMemory.activeTables[tableNum];
            return res.json({ success: true, cashbackAwarded: cashback, activeTables: fallbackMemory.activeTables });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 8. Каталог товаров Mr. Po
app.get('/api/products', async (req, res) => {
    if (!db) return res.json(fallbackMemory.products);
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
    if (db) {
        await db.collection('products').insertOne(newProduct);
        const products = await db.collection('products').find({}).toArray();
        return res.json({ success: true, products });
    } else {
        fallbackMemory.products.push(newProduct);
        return res.json({ success: true, products: fallbackMemory.products });
    }
});

app.post('/api/products/update', async (req, res) => {
    const { id, name, category, stock, price } = req.body;
    if (db) {
        await db.collection('products').updateOne(
            { id: Number(id) },
            { $set: { name, category, stock: Number(stock), price: Number(price) } }
        );
        const products = await db.collection('products').find({}).toArray();
        return res.json({ success: true, products });
    } else {
        const idx = fallbackMemory.products.findIndex(p => String(p.id) === String(id));
        if (idx !== -1) {
            fallbackMemory.products[idx] = { ...fallbackMemory.products[idx], name, category, stock: Number(stock), price: Number(price) };
        }
        return res.json({ success: true, products: fallbackMemory.products });
    }
});

app.post('/api/products/delete', async (req, res) => {
    const { id } = req.body;
    if (db) {
        await db.collection('products').deleteOne({ id: Number(id) });
        const products = await db.collection('products').find({}).toArray();
        return res.json({ success: true, products });
    } else {
        fallbackMemory.products = fallbackMemory.products.filter(p => String(p.id) !== String(id));
        return res.json({ success: true, products: fallbackMemory.products });
    }
});

startServer();
