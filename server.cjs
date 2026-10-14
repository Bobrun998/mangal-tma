require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

const STAFF_MEMBERS = {
    '848502221': { name: 'Влада', role: 'waiter', title: 'Официант' },
    '5676195545': { name: 'Никита', role: 'hookah', title: 'Кальянный мастер' },
    '6804474400': { name: 'Дастан', role: 'manager', title: 'Менеджер' },
    '1787388463': { name: 'Полина', role: 'waiter', title: 'Официант' }
};

function loadDB() {
    try {
        if (fs.existsSync(DB_FILE)) {
            return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Ошибка чтения базы данных:', e);
    }
    return {
        users: {},
        activeTables: {},
        products: [
            { id: 1, name: 'Люля-кебаб (баранина)', category: 'Полуфабрикаты', stock: 8, price: 150000 },
            { id: 2, name: 'Стейк Рибай Premium', category: 'Мясо', stock: 3, price: 450000 },
            { id: 3, name: 'Пельмени фирменные', category: 'Заморозка', stock: 12, price: 120000 },
            { id: 4, name: 'Чизкейк Нью-Йорк', category: 'Десерты', stock: 5, price: 85000 }
        ]
    };
}

let db = loadDB();

function saveDB() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
    } catch (e) {
        console.error('Ошибка записи базы данных:', e);
    }
}

// 1. Авторизация и фиксация реферала
app.post('/api/init-user', (req, res) => {
    let { userId, firstName, photoUrl, startParam } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId обязателен' });

    const strId = String(userId).trim();
    const staffInfo = STAFF_MEMBERS[strId] || null;

    if (!db.users[strId]) {
        let referrerId = null;
        let bonusBalance = 300;

        if (startParam) {
            referrerId = String(startParam).replace('ref_', '').trim();
            // Предотвращаем самоприглашение
            if (referrerId === strId) {
                referrerId = null;
            } else if (db.users[referrerId]) {
                db.users[referrerId].bonusBalance = (db.users[referrerId].bonusBalance || 0) + 100;
                db.users[referrerId].referrals = db.users[referrerId].referrals || [];
                
                const alreadyAdded = db.users[referrerId].referrals.some(r => String(r.userId) === strId);
                if (!alreadyAdded) {
                    db.users[referrerId].referrals.push({
                        userId: strId,
                        name: firstName || 'Гость',
                        joinedAt: new Date().toLocaleDateString('ru-RU'),
                        earnedFromUser: 0
                    });
                }
            }
        }

        db.users[strId] = {
            id: strId,
            firstName: firstName || (staffInfo ? staffInfo.name : 'Гость'),
            photoUrl: photoUrl || '',
            referredBy: referrerId,
            bonusBalance: bonusBalance,
            level: 'Серебро',
            clientNotes: '',
            referrals: []
        };
        saveDB();
    } else {
        if (photoUrl && !db.users[strId].photoUrl) {
            db.users[strId].photoUrl = photoUrl;
            saveDB();
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

app.post('/api/user/update-name', (req, res) => {
    const { userId, newName } = req.body;
    const strId = String(userId).trim();
    if (db.users[strId]) {
        db.users[strId].firstName = newName;
        saveDB();
        return res.json({ success: true, user: db.users[strId] });
    }
    res.status(404).json({ error: 'Пользователь не найден' });
});

app.get('/api/staff/client-info/:userId', (req, res) => {
    const strId = String(req.params.userId).trim();
    const client = db.users[strId] || {
        id: strId,
        firstName: 'Новый гость',
        bonusBalance: 300,
        level: 'Серебро',
        clientNotes: ''
    };
    res.json(client);
});

app.post('/api/staff/open-table', (req, res) => {
    const { tableNum, userId, notes, staffName } = req.body;
    const strId = String(userId).trim();
    
    if (db.users[strId]) {
        db.users[strId].clientNotes = notes || '';
    }

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
    saveDB();
    res.json({ success: true, activeTables: db.activeTables });
});

app.post('/api/staff/update-client-notes', (req, res) => {
    const { userId, notes, tableNum } = req.body;
    const strId = String(userId).trim();
    if (db.users[strId]) {
        db.users[strId].clientNotes = notes;
    }
    if (tableNum && db.activeTables[tableNum]) {
        db.activeTables[tableNum].notes = notes;
    }
    saveDB();
    res.json({ success: true, activeTables: db.activeTables });
});

app.post('/api/staff/close-table', (req, res) => {
    const { tableNum, orderTotal } = req.body;
    const table = db.activeTables[tableNum];
    if (!table) return res.status(404).json({ error: 'Стол не найден' });

    const client = db.users[table.userId];
    const amount = Number(orderTotal) || 0;

    // Кешбэк гостю 3%
    const cashback = Math.round(amount * 0.03);
    if (client) {
        client.bonusBalance = (client.bonusBalance || 0) + cashback;
    }

    // Реферальный бонус 5%
    if (client && client.referredBy && db.users[client.referredBy]) {
        const referrer = db.users[client.referredBy];
        const refBonus = Math.round(amount * 0.05);
        referrer.bonusBalance = (referrer.bonusBalance || 0) + refBonus;
        
        referrer.referrals = referrer.referrals || [];
        const refRecord = referrer.referrals.find(r => String(r.userId) === String(client.id));
        if (refRecord) {
            refRecord.earnedFromUser = (refRecord.earnedFromUser || 0) + refBonus;
        }
    }

    delete db.activeTables[tableNum];
    saveDB();
    res.json({ success: true, cashbackAwarded: cashback, activeTables: db.activeTables });
});

app.get('/api/products', (req, res) => res.json(db.products));

app.post('/api/products/add', (req, res) => {
    const { name, category, stock, price } = req.body;
    const newProduct = {
        id: Date.now(),
        name,
        category: category || 'Мясо',
        stock: Number(stock) || 0,
        price: Number(price) || 0
    };
    db.products.push(newProduct);
    saveDB();
    res.json({ success: true, products: db.products });
});

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
        saveDB();
        return res.json({ success: true, products: db.products });
    }
    res.status(404).json({ error: 'Товар не найден' });
});

app.post('/api/products/delete', (req, res) => {
    const { id } = req.body;
    db.products = db.products.filter(p => String(p.id) !== String(id));
    saveDB();
    res.json({ success: true, products: db.products });
});

app.listen(PORT, () => console.log(`Mangal Backend активен на порту ${PORT}`));
