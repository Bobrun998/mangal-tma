import React, { useState, useEffect } from 'react';
import './index.css';

// Горящая шкала лояльности
const EliteProgressBar = ({ progress }) => {
    const sparks = Array.from({ length: 15 });
    return (
        <div className="fire-bar-bg">
            <div className="fire-bar-fill" style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}>
                {sparks.map((_, i) => (
                    <div
                        key={i}
                        className="loyalty-spark"
                        style={{
                            right: `${Math.random() * 20}px`,
                            top: `${Math.random() * 100}%`,
                            width: `${Math.random() * 4 + 2}px`,
                            height: `${Math.random() * 4 + 2}px`,
                            animation: `horizontalSpark ${Math.random() * 0.8 + 0.4}s linear infinite`,
                            animationDelay: `${Math.random()}s`
                        }}
                    ></div>
                ))}
            </div>
        </div>
    );
};

// Анимированная панда Mr. Po
const AnimatedPanda = () => {
    const [isEating, setIsEating] = useState(false);
    const [food, setFood] = useState('');
    const foods = ['🥟', '🥩', '🐟', '🍤'];

    const triggerEat = () => {
        if (isEating) return;
        setFood(foods[Math.floor(Math.random() * foods.length)]);
        setIsEating(true);
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
        }
        setTimeout(() => setIsEating(false), 700);
    };

    useEffect(() => {
        const timer = setTimeout(triggerEat, 600);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="panda-wrapper" onClick={triggerEat}>
            <img
                src="/icon.png"
                onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "https://cdn-icons-png.flaticon.com/512/3069/3069172.png";
                }}
                alt="Mr. Po"
                className={`panda-img ${isEating ? 'eating' : ''}`}
            />
            <div className={`flying-food ${isEating ? 'animate' : ''}`}>{food}</div>
        </div>
    );
};

export default function App() {
    const [brand, setBrand] = useState('Mangal');
    const [isCabinetOpen, setIsCabinetOpen] = useState(false);

    // Чистый профиль без выдуманных тестовых балансов
    const [user, setUser] = useState({
        id: null,
        firstName: 'Гость',
        bonusBalance: 0,
        level: 'Гость',
        progress: 0,
        referrals: []
    });

    useEffect(() => {
        document.body.className = brand === 'MrPo' ? 'theme-mrpo' : '';
    }, [brand]);

    // Инициализация Telegram WebApp и синхронизация с бэкендом
    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        if (tg) {
            tg.expand();
            tg.ready();

            const tgUser = tg.initDataUnsafe?.user;
            const startParam = tg.initDataUnsafe?.start_param;

            const currentUserId = tgUser?.id || 7770001;
            const currentFirstName = tgUser?.first_name || 'Гость';

            fetch('http://localhost:3000/api/init-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUserId,
                    firstName: currentFirstName,
                    startParam: startParam
                })
            })
                .then(res => res.json())
                .then(data => {
                    setUser(prev => ({
                        ...prev,
                        ...data,
                        photoUrl: tgUser?.photo_url
                    }));
                })
                .catch(() => {
                    // Фолбэк для локального тестирования в браузере без запущенного бэкенда
                    setUser(prev => ({
                        ...prev,
                        id: currentUserId,
                        firstName: currentFirstName
                    }));
                });
        }
    }, []);

    // Открытие E-Menu KiotViet
    const openMenu = () => {
        const url = 'https://emenu.kiotviet.vn/501208761/362144/1411239';
        if (window.Telegram?.WebApp?.openLink) {
            window.Telegram.WebApp.openLink(url);
        } else {
            window.open(url, '_blank');
        }
    };

    // Приглашение друга (5% с его заказов)
    const handleInvite = () => {
        const botUsername = 'mangal_lounge_bot'; // Замените на юзернейм вашего бота
        const inviteLink = `https://t.me/${botUsername}/app?startapp=ref_${user?.id || ''}`;
        const messageText = "Залетай в Mangal Lounge! Открывай столик, заказывай стейки и кальяны по ссылке:";
        const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(messageText)}`;

        if (window.Telegram?.WebApp?.openTelegramLink) {
            window.Telegram.WebApp.openTelegramLink(tgUrl);
        } else {
            window.open(tgUrl, '_blank');
        }
    };

    // Вызовы персонала
    const triggerCall = (type) => {
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('heavy');
        }
        alert(type === 'waiter' ? 'Официант уведомлен и направляется к столу' : 'Кальянный мастер уже в пути');
    };

    const renderWaiterSparks = () => Array.from({ length: 6 }).map((_, i) => (
        <div
            key={i}
            className="hq-spark"
            style={{
                left: `${15 + Math.random() * 70}%`,
                animation: `hqShoot ${0.6 + Math.random() * 0.5}s ease-out infinite`,
                animationDelay: `${Math.random()}s`,
                height: `${10 + Math.random() * 15}px`
            }}
        ></div>
    ));

    const renderHookahSmoke = () => Array.from({ length: 5 }).map((_, i) => (
        <div
            key={i}
            className="hq-smoke"
            style={{
                left: `${20 + Math.random() * 60}%`,
                animation: `hqSmokeRise ${2 + Math.random() * 1.5}s ease-in infinite`,
                animationDelay: `${Math.random() * 2}s`
            }}
        ></div>
    ));

    return (
        <div className="app-container">
            {/* Видео-фон */}
            <video className="video-background" autoPlay loop muted playsInline>
                <source src="/228 - Trim.mp4" type="video/mp4" />
            </video>
            <div className="bg-overlay"></div>

            {/* Шапка */}
            <header className="header">
                <div
                    className="avatar"
                    onClick={() => {
                        if (window.Telegram?.WebApp?.HapticFeedback) {
                            window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
                        }
                        setIsCabinetOpen(true);
                    }}
                >
                    {user?.photoUrl ? (
                        <img src={user.photoUrl} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                    ) : (
                        '👤'
                    )}
                </div>

                <div className="logo-container">
                    {brand === 'Mangal' ? (
                        <h1 className="mangal-logo">
                            MANGAL <span style={{ display: 'inline-block', animation: 'chew 2s infinite alternate' }}>🔥</span> LOUNGE
                        </h1>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
                            <h1 className="mrpo-logo">Mr. Po</h1>
                            <AnimatedPanda />
                        </div>
                    )}
                </div>
                <div className="qr-btn" onClick={() => alert(`Ваш ID для кассира: ${user?.id || '...'}`)}>
                    QR
                </div>
            </header>

            {/* Бегущая строка */}
            <div className="cashback-ticker">
                <marquee>
                    {brand === 'Mangal'
                        ? "⚡ Кешбэк 5% с каждого чека • Получай 5% с заказов приглашенных друзей • Дымные кальяны и гриль"
                        : "❄️ Свежая заморозка • Скидка 10% на премиум стейки при заказе от 500k VND"}
                </marquee>
            </div>

            {/* Сетка основных кнопок */}
            <div className="grid">
                <button className="btn" onClick={openMenu}>
                    <span className="btn-icon">📖</span> Наше меню
                </button>
                <button className="btn" onClick={() => setBrand(brand === 'Mangal' ? 'MrPo' : 'Mangal')}>
                    <span className="btn-icon">🥩</span> {brand === 'Mangal' ? 'Наша продукция' : 'Вернуться в Lounge'}
                </button>
                <button className="btn btn-wide" onClick={() => alert('Раздел партнеров (Нячанг)')}>
                    <span className="btn-icon" style={{ fontSize: '22px' }}>🤝</span> Партнеры
                </button>

                {brand === 'Mangal' && (
                    <>
                        <button className="btn btn-call btn-waiter" onClick={() => triggerCall('waiter')}>
                            <div className="hq-sparks-container">{renderWaiterSparks()}</div>
                            🤵 Позвать<br />Официанта
                        </button>
                        <button className="btn btn-call btn-hookah" onClick={() => triggerCall('hookah')}>
                            <div className="hq-smoke-container">{renderHookahSmoke()}</div>
                            💨 Позвать<br />Кальянщика
                        </button>
                    </>
                )}

                <button className="btn btn-wide btn-invite" onClick={handleInvite}>
                    <span style={{ fontSize: '22px', marginRight: '10px' }}>🎁</span> Пригласить друга (5% с его заказов)
                </button>
            </div>

            {/* Каталог продукции Mr. Po */}
            {brand === 'MrPo' && (
                <div className="mrpo-catalog">
                    <button style={{ width: '100%', padding: '14px', background: '#e94560', color: 'white', border: 'none', borderRadius: '12px', marginBottom: '18px', fontWeight: 'bold', fontSize: '16px' }}>
                        + Добавить позицию (Админ)
                    </button>
                    <div className="tabs">
                        <div className="tab active">Мясо</div>
                        <div className="tab">Полуфабрикаты</div>
                        <div className="tab">Заморозка</div>
                        <div className="tab">Десерты</div>
                    </div>

                    <div className="product-card">
                        <div>
                            <h3 style={{ margin: '0 0 6px 0', fontSize: '17px' }}>Люля-кебаб (баранина)</h3>
                            <p style={{ margin: 0, fontSize: '13px', color: '#aaa' }}>В наличии: 8 упаковок</p>
                        </div>
                        <div style={{ fontWeight: '900', color: 'var(--mrpo-accent)', fontSize: '16px' }}>150,000 ₫</div>
                    </div>
                    <div className="product-card">
                        <div>
                            <h3 style={{ margin: '0 0 6px 0', fontSize: '17px' }}>Стейк Рибай Premium</h3>
                            <p style={{ margin: 0, fontSize: '13px', color: '#aaa' }}>В наличии: 3 шт</p>
                        </div>
                        <div style={{ fontWeight: '900', color: 'var(--mrpo-accent)', fontSize: '16px' }}>450,000 ₫</div>
                    </div>
                </div>
            )}

            {/* Всплывающий Личный Кабинет */}
            <div className={`modal-overlay ${isCabinetOpen ? 'active' : ''}`} onClick={() => setIsCabinetOpen(false)}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <button className="close-btn" onClick={() => setIsCabinetOpen(false)}>×</button>

                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#222', border: '3px solid #ff9800', margin: '0 auto 15px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '35px', overflow: 'hidden' }}>
                        {user?.photoUrl ? <img src={user.photoUrl} alt="Avatar" style={{ width: '100%', height: '100%' }} /> : '👤'}
                    </div>

                    <h3 style={{ margin: '0 0 5px 0', fontSize: '22px' }}>{user.firstName}</h3>
                    <p style={{ margin: 0, color: '#bbb', fontSize: '14px', marginBottom: '20px' }}>
                        Статус: <b style={{ color: '#ff9800' }}>{user.level}</b>
                    </p>

                    <h2 style={{ margin: '0 0 10px 0', fontSize: '32px', fontWeight: '800', textShadow: '0 0 15px rgba(255,152,0,0.5)' }}>
                        {Number(user.bonusBalance || 0).toLocaleString()} баллов
                    </h2>

                    <EliteProgressBar progress={user.progress || 0} />

                    {/* Список друзей и пассивный кешбэк */}
                    <div style={{ marginTop: '25px', textAlign: 'left', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--accent-amber)' }}>
                                Приглашенные друзья
                            </span>
                            <span style={{ fontSize: '12px', color: '#888' }}>
                                Всего: {user?.referrals?.length || 0}
                            </span>
                        </div>

                        {(!user?.referrals || user.referrals.length === 0) ? (
                            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '12px', borderRadius: '12px', fontSize: '12px', color: '#888', textAlign: 'center' }}>
                                Отправьте ссылку друзьям и получайте 5% с каждого их чека!
                            </div>
                        ) : (
                            <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {user.referrals.map((friend, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            background: 'rgba(255,255,255,0.05)',
                                            padding: '8px 12px',
                                            borderRadius: '10px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            borderLeft: '3px solid var(--accent-amber)'
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontSize: '13px', fontWeight: '600' }}>👤 {friend.name}</div>
                                            <div style={{ fontSize: '11px', color: '#777' }}>с {friend.joinedAt}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ color: '#4caf50', fontWeight: 'bold', fontSize: '13px' }}>
                                                +{Number(friend.earnedFromUser || 0).toLocaleString()} ₫
                                            </div>
                                            <div style={{ fontSize: '10px', color: '#777' }}>пассивный кешбэк</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}