require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Ставки кешбэка: 5% клиенту и 5% пригласившему
const CLIENT_CASHBACK_PERCENT = 0.05;
const REFERRER_CASHBACK_PERCENT = 0.05;

// Конфигурация KiotViet API
const KIOTVIET_CONFIG = {
    clientId: process.env.KIOTVIET_CLIENT_ID || 'YOUR_CLIENT_ID',
    clientSecret: process.env.KIOTVIET_CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
    retailer: process.env.KIOTVIET_RETAILER || 'YOUR_RETAILER'
};

// Кеш для токена и меню KiotViet
let kiotVietCache = {
    token: null,
    tokenExpires: 0,
    menu: [],
    menuUpdated: 0
};

// Хранилище пользователей
const db = {
    users: {}
};

// 1. Авторизация в KiotViet API
async function getKiotVietToken() {
    if (kiotVietCache.token && Date.now() < kiotVietCache.tokenExpires) {
        return kiotVietCache.token;
    }
    try {
        const response = await axios.post(
            'https://id.kiotviet.vn/connect/token',
            new URLSearchParams({
                scopes: 'PublicApi.Access',
                grant_type: 'client_credentials',
                client_id: KIOTVIET_CONFIG.clientId,
                client_secret: KIOTVIET_CONFIG.clientSecret
            }).toString(),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        kiotVietCache.token = response.data.access_token;
        kiotVietCache.tokenExpires = Date.now() + (response.data.expires_in * 1000) - 60000;
        return kiotVietCache.token;
    } catch (error) {
        console.error('Ошибка авторизации KiotViet:', error.response?.data || error.message);
        return null;
    }
}

// 2. Чтение меню KiotViet
app.get('/api/menu', async (req, res) => {
    if (kiotVietCache.menu && kiotVietCache.menu.length > 0 && Date.now() - kiotVietCache.menuUpdated < 15 * 60 * 1000) {
        return res.json(kiotVietCache.menu);
    }

    const token = await getKiotVietToken();
    if (!token) return res.status(500).json({ error: 'Ошибка доступа к API кассы' });

    try {
        const response = await axios.get('https://public.kiotapi.com/products', {
            headers: {
                Authorization: `Bearer ${token}`,
                Retailer: KIOTVIET_CONFIG.retailer
            },
            params: { pageSize: 100 }
        });
        kiotVietCache.menu = response.data.data;
        kiotVietCache.menuUpdated = Date.now();
        res.json(kiotVietCache.menu);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка загрузки меню' });
    }
});

// 3. Инициализация пользователя и учет рефералов (старт с 0 баллов)
app.post('/api/init-user', (req, res) => {
    const { userId, firstName, startParam } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId обязателен' });

    if (!db.users[userId]) {
        let referrerId = null;

        // Фиксация пригласившего по ref_ID
        if (startParam && String(startParam).startsWith('ref_')) {
            referrerId = String(startParam).replace('ref_', '');

            if (db.users[referrerId]) {
                db.users[referrerId].referrals.push({
                    userId: userId,
                    name: firstName || 'Друг',
                    joinedAt: new Date().toLocaleDateString('ru-RU'),
                    totalSpent: 0,
                    earnedFromUser: 0
                });
            }
        }

        db.users[userId] = {
            id: userId,
            firstName: firstName || 'Гость',
            referredBy: referrerId,
            bonusBalance: 0,
            level: 'Гость',
            progress: 0,
            referrals: []
        };
    }

    res.json(db.users[userId]);
});

// 4. Закрытие чека (5% клиенту + 5% пригласившему)
app.post('/api/orders/complete', (req, res) => {
    const { clientUserId, orderTotal } = req.body;
    const client = db.users[clientUserId];

    if (!client) return res.status(404).json({ error: 'Клиент не найден' });

    const total = Number(orderTotal) || 0;
    const clientCashback = Math.round(total * CLIENT_CASHBACK_PERCENT);
    client.bonusBalance += clientCashback;

    let referrerBonus = 0;
    const referrerId = client.referredBy;

    if (referrerId && db.users[referrerId]) {
        const referrer = db.users[referrerId];
        referrerBonus = Math.round(total * REFERRER_CASHBACK_PERCENT);
        referrer.bonusBalance += referrerBonus;

        const refItem = referrer.referrals.find(r => String(r.userId) === String(clientUserId));
        if (refItem) {
            refItem.totalSpent += total;
            refItem.earnedFromUser += referrerBonus;
        }
    }

    res.json({
        success: true,
        orderTotal: total,
        clientCashback,
        referrerBonus
    });
});

app.listen(PORT, () => {
    console.log(`Бэкенд-сервер успешно запущен на порту ${PORT}`);
});
