require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Белый список персонала команды Mangal Lounge
const STAFF_MEMBERS = {
    '848502221': { name: 'Влада', role: 'waiter', title: 'Официант' },
    '5676195545': { name: 'Никита', role: 'hookah', title: 'Кальянный мастер' },
    '6804474400': { name: 'Дастан', role: 'manager', title: 'Менеджер' },
    '1787388463': { name: 'Полина', role: 'waiter', title: 'Официант' }
};

// Хранилище данных
const db = {
    users: {},
    activeTables: {},
    products: [
        { id: 1, name: 'Люля-кебаб (баранина)', category: 'Полуфабрикаты', stock: 8, price: 150000 },
        { id: 2, name: 'Стейк Рибай Premium', category: 'Мясо', stock: 3, price: 450000 },
        { id: 3, name: 'Пельмени фирменные', category: 'Заморозка', stock: 12, price: 120000 },
        { id: 4, name: 'Чизкейк Нью-Йорк', category: 'Десерты', stock: 5, price: 85000 }
    ]
};

// 1. Авторизация и загрузка профиля
app.post('/api/init-user', (req, res) => {
    const { userId, firstName, photoUrl, startParam } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId обязателен' });

    const strId = String(userId);
    const staffInfo = STAFF_MEMBERS[strId] || null;

    if (!db.users[strId]) {
        let referrerId = null;
        let bonusBalance = 300;

        if (startParam && startParam.startsWith('ref_')) {
            referrerId = startParam.replace('ref_', '');
            if (db.users[referrerId]) {
                db.users[referrerId].bonusBalance = (db.users[referrerId].bonusBalance || 0) + 100;
            }
        }

        db.users[strId] = {
            id: strId,
            firstName: firstName || 'Гость',
            photoUrl: photoUrl || '',
            referredBy: referrerId,
            bonusBalance: bonusBalance,
            level: 'Серебро',
            notes: ''
        };
    } else {
        if (photoUrl && !db.users[strId].photoUrl) {
            db.users[strId].photoUrl = photoUrl;
        }
    }

    res.json({
        user: db.users[strId],
        isStaff: Boolean(staffInfo),
        staffInfo: staffInfo,
        activeTables: staffInfo ? db.activeTables : undefined,
        products: db.products
    });
});

// 2. Получение каталога продукции Mr. Po
app.get('/api/products', (req, res) => {
    res.json(db.products);
});

// 3. Управление продукцией: Добавление
app.post('/api/products/add', (req, res) => {
    const { name, category, stock, price } = req.body;
    if (!name || !price) return res.status(400).json({ error: 'Заполните обязательные поля' });

    const newProduct = {
        id: Date.now(),
        name,
        category: category || 'Мясо',
        stock: Number(stock) || 0,
        price: Number(price) || 0
    };
    db.products.push(newProduct);
    res.json({ success: true, products: db.products });
});

// 4. Управление продукцией: Редактирование
app.post('/api/products/update', (req, res) => {
    const { id, name, category, stock, price } = req.body;
    const index = db.products.findIndex(p => String(p.id) === String(id));
    if (index !== -1) {
        db.products[index] = {
            ...db.products[index],
            name: name || db.products[index].name,
            category: category || db.products[index].category,
            stock: stock !== undefined ? Number(stock) : db.products[index].stock,
            price: price !== undefined ? Number(price) : db.products[index].price
        };
        return res.json({ success: true, products: db.products });
    }
    res.status(404).json({ error: 'Товар не найден' });
});

// 5. Управление продукцией: Удаление
app.post('/api/products/delete', (req, res) => {
    const { id } = req.body;
    db.products = db.products.filter(p => String(p.id) !== String(id));
    res.json({ success: true, products: db.products });
});

// 6. Смена имени гостя
app.post('/api/user/update-name', (req, res) => {
    const { userId, newName } = req.body;
    const strId = String(userId);
    if (db.users[strId]) {
        db.users[strId].firstName = newName;
        return res.json({ success: true, user: db.users[strId] });
    }
    res.status(404).json({ error: 'Пользователь не найден' });
});

// 7. Получение инфо о госте по сканированному ID
app.get('/api/staff/client-info/:userId', (req, res) => {
    const strId = String(req.params.userId);
    const client = db.users[strId] || {
        id: strId,
        firstName: 'Новый гость',
        bonusBalance: 300,
        level: 'Серебро',
        notes: ''
    };
    res.json(client);
});

// 8. Открытие стола и привязка гостя
app.post('/api/staff/open-table', (req, res) => {
    const { tableNum, userId, notes, staffName } = req.body;
    const strId = String(userId);
    const client = db.users[strId] || { firstName: 'Гость', level: 'Серебро' };
    
    db.activeTables[tableNum] = {
        tableNum,
        userId: strId,
        clientName: client.firstName,
        clientLevel: client.level || 'Серебро',
        notes: notes || '',
        staffName: staffName || 'Персонал',
        openedAt: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    };
    res.json({ success: true, activeTables: db.activeTables });
});

// 9. Закрытие стола с расчетом кешбэка
app.post('/api/staff/close-table', (req, res) => {
    const { tableNum, orderTotal } = req.body;
    const table = db.activeTables[tableNum];
    if (!table) return res.status(404).json({ error: 'Стол не найден' });

    const client = db.users[table.userId];
    const amount = Number(orderTotal) || 0;

    const cashback = Math.round(amount * 0.10);
    if (client) {
        client.bonusBalance = (client.bonusBalance || 0) + cashback;
    }

    if (client && client.referredBy && db.users[client.referredBy]) {
        db.users[client.referredBy].bonusBalance = (db.users[client.referredBy].bonusBalance || 0) + Math.round(amount * 0.05);
    }

    delete db.activeTables[tableNum];
    res.json({ success: true, cashbackAwarded: cashback, activeTables: db.activeTables });
});

app.listen(PORT, () => console.log(`Mangal Backend активен на порту ${PORT}`));
