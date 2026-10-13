import React, { useState, useEffect } from 'react';
import './index.css';

const EliteProgressBar = ({ progress }) => {
    const sparks = Array.from({ length: 15 });
    return (
        <div className="fire-bar-bg">
            <div className="fire-bar-fill" style={{ width: `${progress}%` }}>
                {sparks.map((_, i) => (
                    <div key={i} className="loyalty-spark" style={{
                        right: `${Math.random() * 20}px`,
                        top: `${Math.random() * 100}%`,
                        width: `${Math.random() * 4 + 2}px`,
                        height: `${Math.random() * 4 + 2}px`,
                        animation: `horizontalSpark ${Math.random() * 0.8 + 0.4}s linear infinite`,
                        animationDelay: `${Math.random()}s`
                    }}></div>
                ))}
            </div>
        </div>
    );
};

const AnimatedPanda = () => {
    const [isEating, setIsEating] = useState(false);
    const [food, setFood] = useState('');
    const foods = ['🥟', '🥩', '🐟', '🍤'];

    const triggerEat = () => {
        if (isEating) return;
        setFood(foods[Math.floor(Math.random() * foods.length)]);
        setIsEating(true);
        if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
        setTimeout(() => setIsEating(false), 700);
    };

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
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    
    // Профиль гостя
    const [user, setUser] = useState(null);
    const [isEditingName, setIsEditingName] = useState(false);
    const [customName, setCustomName] = useState('');

    // Каталог товаров Mr. Po
    const [products, setProducts] = useState([]);
    const [activeCategory, setActiveCategory] = useState('Все');

    // Режим персонала
    const [isStaff, setIsStaff] = useState(false);
    const [staffInfo, setStaffInfo] = useState(null);
    const [staffTab, setStaffTab] = useState('tables'); // 'tables' или 'products'
    const [activeTables, setActiveTables] = useState({});
    const [selectedTable, setSelectedTable] = useState(null);
    const [scannedClient, setScannedClient] = useState(null);
    const [tableInput, setTableInput] = useState('');
    const [notesInput, setNotesInput] = useState('');
    const [orderSumInput, setOrderSumInput] = useState('');

    // Форма редактирования/добавления товаров для персонала
    const [editingProduct, setEditingProduct] = useState(null);
    const [prodName, setProdName] = useState('');
    const [prodCategory, setProdCategory] = useState('Мясо');
    const [prodStock, setProdStock] = useState('');
    const [prodPrice, setProdPrice] = useState('');

    const BACKEND_URL = 'https://mangal-tma.onrender.com';

    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        if (tg) {
            tg.ready();
            tg.expand();
        }
        const tgUser = tg?.initDataUnsafe?.user || { id: 123456789, first_name: 'Гость', photo_url: '' };
        const startParam = tg?.initDataUnsafe?.start_param || '';

        fetch(`${BACKEND_URL}/api/init-user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: tgUser.id,
                firstName: tgUser.first_name,
                photoUrl: tgUser.photo_url || '',
                startParam: startParam
            })
        })
        .then(res => res.json())
        .then(data => {
            setUser(data.user);
            setCustomName(data.user?.firstName || tgUser.first_name);
            setIsStaff(Boolean(data.isStaff));
            setStaffInfo(data.staffInfo);
            if (data.activeTables) setActiveTables(data.activeTables);
            if (data.products) setProducts(data.products);
        })
        .catch(err => console.log('Синхронизация:', err));
    }, []);

    const saveNewName = () => {
        if (!customName.trim() || !user) return;
        fetch(`${BACKEND_URL}/api/user/update-name`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, newName: customName })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                setUser(data.user);
                setIsEditingName(false);
            }
        });
    };

    const handleScanQr = () => {
        const tg = window.Telegram?.WebApp;
        if (tg?.showScanQrPopup) {
            tg.showScanQrPopup({ text: 'Наведите камеру на QR-код гостя' }, (scannedText) => {
                const clientId = scannedText.replace('mangal_guest_', '');
                fetchClientData(clientId);
                tg.closeScanQrPopup();
                return true;
            });
        } else {
            const testId = prompt('Введите Telegram ID гостя:', '123456789');
            if (testId) fetchClientData(testId.replace('mangal_guest_', ''));
        }
    };

    const fetchClientData = (clientId) => {
        fetch(`${BACKEND_URL}/api/staff/client-info/${clientId}`)
            .then(res => res.json())
            .then(client => {
                setScannedClient(client);
                setNotesInput(client.notes || '');
            });
    };

    const handleSeatGuest = () => {
        if (!tableInput || !scannedClient) return alert('Укажите номер стола');
        fetch(`${BACKEND_URL}/api/staff/open-table`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tableNum: tableInput,
                userId: scannedClient.id,
                notes: notesInput,
                staffName: staffInfo?.name || 'Сотрудник'
            })
        })
        .then(res => res.json())
        .then(data => {
            setActiveTables(data.activeTables);
            setScannedClient(null);
            setTableInput('');
            setNotesInput('');
        });
    };

    const handleCloseTable = (tableNum) => {
        if (!orderSumInput) return alert('Введите сумму заказа');
        fetch(`${BACKEND_URL}/api/staff/close-table`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tableNum,
                orderTotal: Number(orderSumInput)
            })
        })
        .then(res => res.json())
        .then(data => {
            alert(`Стол №${tableNum} закрыт! Начислено бонусов гостю: ${data.cashbackAwarded.toLocaleString()} ₫`);
            setActiveTables(data.activeTables);
            setSelectedTable(null);
            setOrderSumInput('');
        });
    };

    // Операции персонала с каталогом Mr. Po
    const handleSaveProduct = () => {
        if (!prodName || !prodPrice) return alert('Укажите название и цену');
        const endpoint = editingProduct?.id ? '/api/products/update' : '/api/products/add';
        const payload = {
            id: editingProduct?.id,
            name: prodName,
            category: prodCategory,
            stock: Number(prodStock),
            price: Number(prodPrice)
        };

        fetch(`${BACKEND_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                setProducts(data.products);
                setEditingProduct(null);
                setProdName('');
                setProdStock('');
                setProdPrice('');
            }
        });
    };

    const handleDeleteProduct = (id) => {
        if (!confirm('Удалить эту позицию?')) return;
        fetch(`${BACKEND_URL}/api/products/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) setProducts(data.products);
        });
    };

    const openEditModal = (p = null) => {
        if (p) {
            setEditingProduct(p);
            setProdName(p.name);
            setProdCategory(p.category);
            setProdStock(p.stock);
            setProdPrice(p.price);
        } else {
            setEditingProduct({});
            setProdName('');
            setProdCategory('Мясо');
            setProdStock('');
            setProdPrice('');
        }
    };

    // ==========================================
    // 1. ПУЛЬТ ПЕРСОНАЛА (ОФИЦИАНТСКОЕ ПРИЛОЖЕНИЕ)
    // ==========================================
    if (isStaff) {
        return (
            <div className="app-container" style={{ padding: '16px' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                        <h2 style={{ margin: 0, color: 'var(--accent-amber)', fontSize: '20px' }}>
                            {staffInfo?.name} ({staffInfo?.title})
                        </h2>
                        <span style={{ fontSize: '11px', color: '#888' }}>Mangal Lounge Staff</span>
                    </div>
                    <span style={{ fontSize: '12px', background: '#2a2a35', padding: '6px 12px', borderRadius: '10px', border: '1px solid #444' }}>
                        ID: {user?.id}
                    </span>
                </header>

                {/* Навигация персонала: Столы / Продукция */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    <button 
                        onClick={() => setStaffTab('tables')}
                        style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: staffTab === 'tables' ? 'var(--accent-amber)' : '#2a2a35', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                        🍽️ Столы ({Object.keys(activeTables).length})
                    </button>
                    <button 
                        onClick={() => setStaffTab('products')}
                        style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: staffTab === 'products' ? '#e94560' : '#2a2a35', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                        🥩 Продукция Mr. Po
                    </button>
                </div>

                {/* Вкладка 1: Столы и сканер */}
                {staffTab === 'tables' && (
                    <>
                        <button 
                            onClick={handleScanQr}
                            style={{ width: '100%', padding: '18px', background: 'linear-gradient(135deg, #ff9800, #d84315)', border: 'none', borderRadius: '16px', color: '#fff', fontSize: '18px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginBottom: '20px', cursor: 'pointer', boxShadow: '0 4px 20px rgba(255,152,0,0.4)' }}
                        >
                            📷 Сканировать QR гостя
                        </button>

                        {scannedClient && (
                            <div style={{ background: '#1c1c24', border: '1px solid #ff9800', borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
                                <h3 style={{ margin: '0 0 6px 0', color: '#ff9800' }}>Гость: {scannedClient.firstName}</h3>
                                <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#bbb' }}>
                                    Баланс: {scannedClient.bonusBalance || 0} ₫ | Статус: {scannedClient.level || 'Серебро'}
                                </p>
                                <input 
                                    type="text" 
                                    placeholder="Номер столика (напр. 4)" 
                                    value={tableInput} 
                                    onChange={e => setTableInput(e.target.value)}
                                    style={{ width: '92%', padding: '12px', borderRadius: '10px', background: '#2a2a35', border: '1px solid #555', color: '#fff', marginBottom: '10px' }}
                                />
                                <textarea 
                                    placeholder="Примечания (кальян, блюда, пожелания)" 
                                    value={notesInput} 
                                    onChange={e => setNotesInput(e.target.value)}
                                    style={{ width: '92%', padding: '12px', borderRadius: '10px', background: '#2a2a35', border: '1px solid #555', color: '#fff', marginBottom: '10px' }}
                                />
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={handleSeatGuest} style={{ flex: 1, padding: '12px', background: '#4caf50', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 'bold' }}>
                                        Посадить за стол
                                    </button>
                                    <button onClick={() => setScannedClient(null)} style={{ padding: '12px', background: '#555', border: 'none', borderRadius: '10px', color: '#fff' }}>
                                        Отмена
                                    </button>
                                </div>
                            </div>
                        )}

                        <h3 style={{ fontSize: '16px', color: '#aaa', marginBottom: '12px' }}>Активные столы:</h3>
                        {Object.keys(activeTables).length === 0 ? (
                            <div style={{ padding: '30px', textAlign: 'center', background: '#181820', borderRadius: '16px', color: '#666', border: '1px dashed #333' }}>
                                Нет открытых столов. Нажмите «Сканировать QR», чтобы посадить гостей.
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                {Object.values(activeTables).map(table => (
                                    <div 
                                        key={table.tableNum}
                                        onClick={() => setSelectedTable(table)}
                                        style={{ background: '#1e1e24', border: '1px solid #ff9800', borderRadius: '14px', padding: '14px', cursor: 'pointer', textAlign: 'center' }}
                                    >
                                        <h4 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#ff9800' }}>Стол №{table.tableNum}</h4>
                                        <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 'bold' }}>{table.clientName}</p>
                                        <span style={{ fontSize: '11px', color: '#888' }}>{table.openedAt} • {table.staffName}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* Вкладка 2: Управление каталогом Mr. Po */}
                {staffTab === 'products' && (
                    <div>
                        <button 
                            onClick={() => openEditModal()}
                            style={{ width: '100%', padding: '14px', background: '#e94560', color: 'white', border: 'none', borderRadius: '12px', marginBottom: '16px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}
                        >
                            + Добавить новую позицию
                        </button>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {products.map(p => (
                                <div key={p.id} style={{ background: '#1c1c28', border: '1px solid #333', borderRadius: '14px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#fff' }}>{p.name}</h4>
                                        <span style={{ fontSize: '12px', color: '#888' }}>{p.category} • В наличии: {p.stock} шт</span>
                                        <div style={{ color: '#e94560', fontWeight: 'bold', marginTop: '4px' }}>{p.price.toLocaleString()} ₫</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => openEditModal(p)} style={{ background: '#333', border: '1px solid #555', color: '#fff', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer' }}>✏️</button>
                                        <button onClick={() => handleDeleteProduct(p.id)} style={{ background: '#442222', border: '1px solid #e53935', color: '#fff', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer' }}>🗑️</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Модалка закрытия счета */}
                {selectedTable && (
                    <div className="modal-overlay active" onClick={() => setSelectedTable(null)}>
                        <div className="modal-content" onClick={e => e.stopPropagation()}>
                            <button className="close-btn" onClick={() => setSelectedTable(null)}>×</button>
                            <h2 style={{ color: '#ff9800', marginTop: 0 }}>Стол №{selectedTable.tableNum}</h2>
                            <p style={{ fontSize: '16px', margin: '5px 0' }}>Гость: <b>{selectedTable.clientName}</b></p>
                            <p style={{ fontSize: '13px', color: '#bbb' }}>Статус: {selectedTable.clientLevel}</p>
                            
                            <div style={{ background: '#25252d', padding: '12px', borderRadius: '10px', margin: '15px 0', textAlign: 'left', fontSize: '13px' }}>
                                <b>Примечания:</b>
                                <p style={{ margin: '5px 0 0 0', color: '#ccc' }}>{selectedTable.notes || 'Нет примечаний'}</p>
                            </div>

                            <input 
                                type="number" 
                                placeholder="Сумма заказа в VND" 
                                value={orderSumInput}
                                onChange={e => setOrderSumInput(e.target.value)}
                                style={{ width: '90%', padding: '14px', borderRadius: '12px', background: '#333', border: '1px solid #666', color: '#fff', fontSize: '18px', marginBottom: '15px', textAlign: 'center' }}
                            />
                            
                            <button 
                                onClick={() => handleCloseTable(selectedTable.tableNum)}
                                style={{ width: '100%', padding: '16px', background: '#e53935', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}
                            >
                                💳 Закрыть стол и начислить баллы
                            </button>
                        </div>
                    </div>
                )}

                {/* Модалка создания/редактирования товара */}
                {editingProduct && (
                    <div className="modal-overlay active" onClick={() => setEditingProduct(null)}>
                        <div className="modal-content" onClick={e => e.stopPropagation()}>
                            <button className="close-btn" onClick={() => setEditingProduct(null)}>×</button>
                            <h3 style={{ color: '#e94560', marginTop: 0 }}>{editingProduct.id ? 'Редактировать товар' : 'Новый товар'}</h3>
                            <input 
                                type="text" 
                                placeholder="Название блюда/товара" 
                                value={prodName} 
                                onChange={e => setProdName(e.target.value)}
                                style={{ width: '90%', padding: '12px', borderRadius: '10px', background: '#333', border: '1px solid #555', color: '#fff', marginBottom: '10px' }}
                            />
                            <select 
                                value={prodCategory} 
                                onChange={e => setProdCategory(e.target.value)}
                                style={{ width: '96%', padding: '12px', borderRadius: '10px', background: '#333', border: '1px solid #555', color: '#fff', marginBottom: '10px' }}
                            >
                                <option value="Мясо">Мясо</option>
                                <option value="Полуфабрикаты">Полуфабрикаты</option>
                                <option value="Заморозка">Заморозка</option>
                                <option value="Десерты">Десерты</option>
                            </select>
                            <input 
                                type="number" 
                                placeholder="Количество на складе" 
                                value={prodStock} 
                                onChange={e => setProdStock(e.target.value)}
                                style={{ width: '90%', padding: '12px', borderRadius: '10px', background: '#333', border: '1px solid #555', color: '#fff', marginBottom: '10px' }}
                            />
                            <input 
                                type="number" 
                                placeholder="Цена в VND" 
                                value={prodPrice} 
                                onChange={e => setProdPrice(e.target.value)}
                                style={{ width: '90%', padding: '12px', borderRadius: '10px', background: '#333', border: '1px solid #555', color: '#fff', marginBottom: '15px' }}
                            />
                            <button 
                                onClick={handleSaveProduct}
                                style={{ width: '100%', padding: '14px', background: '#4caf50', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}
                            >
                                Сохранить
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ==========================================
    // 2. КЛИЕНТСКИЙ ИНТЕРФЕЙС (MANGAL LOUNGE & MR. PO)
    // ==========================================
    const qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=mangal_guest_${user?.id || 123456789}`;

    const filteredProducts = activeCategory === 'Все' 
        ? products 
        : products.filter(p => p.category === activeCategory);

    return (
        <div className="app-container">
            <video className="video-background" autoPlay loop muted playsInline>
                <source src="/228 - Trim.mp4" type="video/mp4" />
            </video>
            <div className="bg-overlay"></div>

            <header className="header">
                <div className="avatar" onClick={() => setIsCabinetOpen(true)}>
                    {user?.photoUrl ? (
                        <img src={user.photoUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <span style={{ fontSize: '20px' }}>👤</span>
                    )}
                </div>
                
                <div className="logo-container">
                    {brand === 'Mangal' ? (
                        <h1 className="mangal-logo">MANGAL <span style={{display: 'inline-block', animation: 'chew 2s infinite alternate'}}>🔥</span> LOUNGE</h1>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
                            <h1 className="mrpo-logo">Mr. Po</h1>
                            <AnimatedPanda />
                        </div>
                    )}
                </div>
                
                <div className="qr-btn" onClick={() => setIsQrModalOpen(true)}>QR</div>
            </header>

            <div className="cashback-ticker">
                <marquee>
                    {brand === 'Mangal' 
                        ? "⚡ Кешбэк 10% • Скидка 50k VND на угли • Пригласи друга и получи бонусы!"
                        : "❄️ Свежая поставка пельменей • Скидка 10% на премиум стейки при заказе от 500k VND"}
                </marquee>
            </div>

            <div className="grid">
                <button className="btn" onClick={() => window.Telegram?.WebApp?.openLink ? window.Telegram.WebApp.openLink('https://emenu.kiotviet.vn/501208761/362144/1411239') : window.open('https://emenu.kiotviet.vn/501208761/362144/1411239', '_blank')}>
                    <span className="btn-icon">📖</span> Наше меню
                </button>
                <button className="btn" onClick={() => setBrand(brand === 'Mangal' ? 'MrPo' : 'Mangal')}>
                    <span className="btn-icon">🥩</span> {brand === 'Mangal' ? 'Наша продукция' : 'Вернуться в Lounge'}
                </button>
                <button className="btn btn-wide" onClick={() => alert('Список партнеров (Нячанг)')}>
                    <span className="btn-icon" style={{fontSize:'22px'}}>🤝</span> Партнеры
                </button>
                
                {brand === 'Mangal' && (
                    <>
                        <button className="btn btn-call btn-waiter" onClick={() => alert('Официант уведомлен!')}>
                            🤵 Позвать<br/>Официанта
                        </button>
                        <button className="btn btn-call btn-hookah" onClick={() => alert('Кальянный мастер в пути!')}>
                            💨 Позвать<br/>Кальянщика
                        </button>
                    </>
                )}
            </div>

            {/* Каталог продукции Mr. Po для гостей (кнопка добавления скрыта) */}
            {brand === 'MrPo' && (
                <div className="mrpo-catalog">
                    <div className="tabs">
                        {['Все', 'Мясо', 'Полуфабрикаты', 'Заморозка', 'Десерты'].map(cat => (
                            <div 
                                key={cat} 
                                className={`tab ${activeCategory === cat ? 'active' : ''}`}
                                onClick={() => setActiveCategory(cat)}
                            >
                                {cat}
                            </div>
                        ))}
                    </div>
                    
                    {filteredProducts.map(p => (
                        <div key={p.id} className="product-card">
                            <div>
                                <h3 style={{ margin: '0 0 6px 0', fontSize: '16px' }}>{p.name}</h3>
                                <p style={{ margin: 0, fontSize: '13px', color: '#aaa' }}>В наличии: {p.stock} шт</p>
                            </div>
                            <div style={{ fontWeight: 'bold', color: 'var(--mrpo-accent)' }}>{p.price.toLocaleString()} ₫</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Модалка QR-кода гостя */}
            {isQrModalOpen && (
                <div className="modal-overlay active" onClick={() => setIsQrModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <button className="close-btn" onClick={() => setIsQrModalOpen(false)}>×</button>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', color: '#ff9800' }}>Ваш персональный QR</h3>
                        <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#bbb' }}>Покажите официанту для начисления кешбэка</p>
                        <div style={{ background: '#fff', padding: '12px', borderRadius: '16px', display: 'inline-block', marginBottom: '14px' }}>
                            <img src={qrDataUrl} alt="QR Code" style={{ width: '200px', height: '200px', display: 'block' }} />
                        </div>
                        <div style={{ fontSize: '12px', color: '#888' }}>ID: {user?.id}</div>
                    </div>
                </div>
            )}

            {/* Личный кабинет */}
            <div className={`modal-overlay ${isCabinetOpen ? 'active' : ''}`} onClick={() => setIsCabinetOpen(false)}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <button className="close-btn" onClick={() => setIsCabinetOpen(false)}>×</button>
                    
                    <div style={{ width: '85px', height: '85px', borderRadius: '50%', border: '3px solid #ff9800', margin: '0 auto 15px', overflow: 'hidden', boxShadow: '0 0 15px rgba(255,152,0,0.4)' }}>
                        {user?.photoUrl ? (
                            <img src={user.photoUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ width: '100%', height: '100%', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '35px' }}>👤</div>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '5px' }}>
                        {isEditingName ? (
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <input 
                                    type="text" 
                                    value={customName} 
                                    onChange={e => setCustomName(e.target.value)} 
                                    style={{ padding: '6px 10px', borderRadius: '8px', background: '#333', border: '1px solid #ff9800', color: '#fff', fontSize: '16px' }}
                                />
                                <button onClick={saveNewName} style={{ background: '#4caf50', border: 'none', borderRadius: '8px', color: '#fff', padding: '6px 10px', cursor: 'pointer' }}>✓</button>
                            </div>
                        ) : (
                            <>
                                <h3 style={{ margin: 0, fontSize: '22px' }}>{user?.firstName || 'Гость'}</h3>
                                <button onClick={() => setIsEditingName(true)} style={{ background: 'transparent', border: 'none', color: '#ff9800', cursor: 'pointer', fontSize: '16px' }}>✏️</button>
                            </>
                        )}
                    </div>

                    <p style={{ margin: 0, color: '#bbb', fontSize: '14px', marginBottom: '20px' }}>Статус: <b style={{color: '#ff9800'}}>{user?.level || 'Серебро'}</b></p>
                    <h2 style={{ margin: '0 0 10px 0', fontSize: '32px', fontWeight: '800' }}>{user?.bonusBalance !== undefined ? user.bonusBalance : 300} ₫</h2>
                    <EliteProgressBar progress={75} />
                </div>
            </div>
        </div>
    );
}
