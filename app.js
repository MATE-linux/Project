// ================== КОНФИГУРАЦИЯ И ДАННЫЕ ==================
// Будем загружать события динамически из папки history
let timelineEvents = [];
let eventsLoaded = false;

// Группы для таймлайна (ветви ОС)
const timelineGroups = [
    { id: 'unix', content: 'UNIX / Linux' },
    { id: 'dos', content: 'MS-DOS' },
    { id: 'windows', content: 'Windows' }
];

// Конфигурация эмуляторов (остается статической, но можно тоже вынести в отдельные файлы)
const emulatorConfigs = {
    'dos': {
        name: 'MS-DOS 6.22',
        biosUrl: 'vendor/v86/bios/seabios.bin',
        vgaBiosUrl: 'vendor/v86/bios/vgabios.bin',
        hdaUrl: 'vendor/v86/images/dos_disk.img',
        autostart: true
    },
    'linux': {
        name: 'Buildroot Linux',
        biosUrl: 'vendor/v86/bios/seabios.bin',
        vgaBiosUrl: 'vendor/v86/bios/vgabios.bin',
        cdromUrl: 'vendor/v86/images/linux.iso',
        autostart: true
    }
};

// Маппинг файлов на конфигурацию эмуляторов
const eventEmulatorMap = {
    '1981.html': 'dos',
    '1991.html': 'linux',
    '1992.html': 'win31'
};

// ================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==================
let visTimeline;
let v86Emulator = null;
let currentEmulatorType = null;

// ================== ЗАГРУЗКА СОБЫТИЙ ИЗ ПАПКИ HISTORY ==================
async function loadEventsFromHistory() {
    try {
        // Список файлов событий
        const eventFiles = [
            { filename: '1969.html', id: 1, start: '1969-01-01', group: 'unix', content: 'UNIX (1969)' },
            { filename: '1981.html', id: 2, start: '1981-08-01', group: 'dos', content: 'MS-DOS 1.0 (1981)' },
            { filename: '1992.html', id: 3, start: '1992-01-01', group: 'windows', content: 'Windows 3.1 (1992)' },
            { filename: '1991.html', id: 4, start: '1991-09-17', group: 'unix', content: 'Linux 0.01 (1991)' }
        ];

        timelineEvents = [];

        for (const eventFile of eventFiles) {
            try {
                const response = await fetch(`history/${eventFile.filename}`);
                if (!response.ok) {
                    throw new Error(`Ошибка загрузки ${eventFile.filename}: ${response.status}`);
                }
                
                const html = await response.text();
                
                // Парсим HTML для получения описания
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                
                // Ищем описание - первый параграф внутри .event-content
                const contentDiv = doc.querySelector('.event-content');
                let description = 'Описание не найдено';
                
                if (contentDiv) {
                    // Берем первый параграф после заголовка
                    const firstParagraph = contentDiv.querySelector('p');
                    if (firstParagraph) {
                        description = firstParagraph.textContent.substring(0, 150) + '...';
                    }
                }
                
                // Определяем конфигурацию эмулятора
                let emulatorConfig = null;
                const emulatorKey = eventEmulatorMap[eventFile.filename];
                
                if (emulatorKey === 'win31') {
                    emulatorConfig = {
                        type: 'iframe',
                        url: 'https://www.pcjs.org/software/pcx86/sys/windows/3.10/'
                    };
                } else if (emulatorKey && emulatorConfigs[emulatorKey]) {
                    emulatorConfig = {
                        type: 'v86',
                        ...emulatorConfigs[emulatorKey]
                    };
                }

                timelineEvents.push({
                    id: eventFile.id,
                    content: eventFile.content,
                    start: eventFile.start,
                    group: eventFile.group,
                    description: description,
                    emulatorConfig: emulatorConfig,
                    detailsFile: eventFile.filename  // Сохраняем имя файла для загрузки деталей
                });
                
            } catch (error) {
                console.error(`Ошибка обработки ${eventFile.filename}:`, error);
                
                // Добавляем событие с информацией об ошибке
                timelineEvents.push({
                    id: eventFile.id,
                    content: eventFile.content,
                    start: eventFile.start,
                    group: eventFile.group,
                    description: `Не удалось загрузить информацию из файла ${eventFile.filename}`,
                    emulatorConfig: null,
                    detailsFile: null
                });
            }
        }
        
        eventsLoaded = true;
        console.log('События загружены:', timelineEvents.length);
        return true;
        
    } catch (error) {
        console.error('Критическая ошибка загрузки событий:', error);
        showMessage('Не удалось загрузить события из папки history', 'error');
        return false;
    }
}

// ================== ЗАГРУЗКА ДЕТАЛЕЙ СОБЫТИЯ ==================
async function loadEventDetails(filename) {
    try {
        const response = await fetch(`history/${filename}`);
        if (!response.ok) throw new Error(`Ошибка загрузки: ${response.status}`);
        
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const contentDiv = doc.querySelector('.event-content');
        
        if (contentDiv) {
            return contentDiv.innerHTML;
        }
        return '<p>Содержимое не найдено</p>';
        
    } catch (error) {
        console.error('Ошибка загрузки деталей:', error);
        return `<p>Не удалось загрузить подробную информацию: ${error.message}</p>`;
    }
}

// ================== ИНИЦИАЛИЗАЦИЯ ТАЙМЛАЙНА ==================
async function initTimeline() {
    if (!eventsLoaded) {
        const loaded = await loadEventsFromHistory();
        if (!loaded) {
            showMessage('Не удалось загрузить события. Проверьте папку history/', 'error');
            return;
        }
    }

    const container = document.getElementById('visual-timeline');
    const items = new vis.DataSet(timelineEvents);
    const groups = new vis.DataSet(timelineGroups);

    const options = {
        stack: false,
        orientation: 'top',
        height: '220px',
        margin: { item: 5 },
        groupOrder: 'content'
    };

    visTimeline = new vis.Timeline(container, items, groups, options);
    visTimeline.on('select', handleTimelineSelect);
}

// ================== ОБРАБОТКА ВЫБОРА В ТАЙМЛАЙНЕ ==================
async function handleTimelineSelect(properties) {
    const selectedId = properties.items[0];
    if (!selectedId) return;

    const event = timelineEvents.find(e => e.id == selectedId);
    if (!event) return;

    // 1. Обновляем заголовок
    document.getElementById('event-title').textContent = event.content;
    
    // 2. Показываем краткое описание
    document.getElementById('event-text').textContent = event.description;
    
    // 3. Загружаем и показываем детали, если есть файл
    if (event.detailsFile) {
        document.getElementById('event-text').innerHTML = '<em>Загрузка подробной информации...</em>';
        
        const detailsHTML = await loadEventDetails(event.detailsFile);
        document.getElementById('event-text').innerHTML = detailsHTML;
    }

    // 4. Обновляем селектор ОС
    const osSelector = document.getElementById('os-selector');
    if (event.emulatorConfig) {
        let optionValue = '';
        if (event.emulatorConfig.type === 'v86' && event.emulatorConfig.name.includes('DOS')) optionValue = 'dos';
        if (event.emulatorConfig.type === 'iframe') optionValue = 'win31';
        if (event.emulatorConfig.type === 'v86' && event.emulatorConfig.name.includes('Linux')) optionValue = 'linux';

        osSelector.value = optionValue;
        document.getElementById('btn-start').textContent = `Запустить ${event.emulatorConfig.name || 'эмулятор'}`;
    } else {
        osSelector.value = '';
        document.getElementById('btn-start').textContent = 'Запустить эмулятор';
        showMessage('Для выбранного события нет доступного эмулятора.', 'info');
    }
}

// ================== РАБОТА С ЭМУЛЯТОРОМ (V86.JS) ==================
function startV86Emulator(config) {
    stopCurrentEmulator();

    const screenContainer = document.getElementById('screen_container');
    if (!screenContainer) {
        console.error('Элемент screen_container не найден!');
        showMessage('Внутренняя ошибка: контейнер для экрана не найден.', 'error');
        return;
    }

    screenContainer.innerHTML = `
        <div style="white-space: pre; font: 14px monospace; line-height: 14px"></div>
        <canvas style="display: none"></canvas>
    `;
    document.getElementById('screen-overlay').style.display = 'none';

    console.log('Запуск v86 с конфигом:', config.name);

    try {
        const v86Config = {
            wasm_path: 'vendor/v86/v86-debug.wasm',
            memory_size: 32 * 1024 * 1024,
            vga_memory_size: 8 * 1024 * 1024,
            screen_container: screenContainer,
            bios: { 
                url: config.biosUrl,
                async: true 
            },
            vga_bios: { 
                url: config.vgaBiosUrl,
                async: true 
            },
            autostart: config.autostart !== undefined ? config.autostart : true,
        };

        if (config.hdaUrl) {
            v86Config.hda = { 
                url: config.hdaUrl,
                async: true 
            };
        }
        if (config.cdromUrl) {
            v86Config.cdrom = { 
                url: config.cdromUrl,
                async: true 
            };
        }

        v86Emulator = new V86(v86Config);
        currentEmulatorType = 'v86';
        
        v86Emulator.add_listener("emulator-ready", function() {
            console.log('Эмулятор готов!');
            showMessage(`${config.name} успешно запущен!`, 'success');
        });
        
        v86Emulator.add_listener("download-progress", function(e) {
            console.log(`Загрузка: ${(e.loaded / 1024 / 1024).toFixed(1)}MB / ${(e.total / 1024 / 1024).toFixed(1)}MB`);
        });
        
        showMessage(`Загружаем ${config.name}...`, 'info');
        
    } catch (error) {
        console.error('Ошибка запуска v86:', error);
        showMessage(`Ошибка: ${error.message}`, 'error');
    }
}

// ================== ОБРАБОТЧИКИ КНОПОК ==================
document.getElementById('btn-start').addEventListener('click', function() {
    const selectedOS = document.getElementById('os-selector').value;
    
    if (!selectedOS) {
        showMessage('Сначала выберите операционную систему из списка.', 'warning');
        return;
    }

    if (selectedOS === 'win31') {
        stopCurrentEmulator();
        const screenContainer = document.getElementById('screen_container');
        screenContainer.innerHTML = `
            <iframe 
                src="https://www.pcjs.org/software/pcx86/sys/windows/3.10/" 
                style="width:100%; height:100%; border:none;"
                allow="autoplay"
                title="Windows 3.1 Emulator"
            ></iframe>`;
        document.getElementById('screen-overlay').style.display = 'none';
        currentEmulatorType = 'iframe';
        showMessage('Windows 3.1 загружается...', 'success');
        return;
    }

    const config = emulatorConfigs[selectedOS];
    if (config) {
        startV86Emulator(config);
    }
});

function stopCurrentEmulator() {
    if (v86Emulator) {
        v86Emulator.stop();
        v86Emulator = null;
    }
    document.getElementById('screen-overlay').style.display = 'flex';
    currentEmulatorType = null;
}

// ================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==================
function showMessage(text, type = 'info') {
    const colors = {
        'info': '#31708f',
        'success': '#3c763d',
        'warning': '#8a6d3b',
        'error': '#a94442'
    };
    
    console.log(`[${type.toUpperCase()}] ${text}`);
    
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px;
        background: ${colors[type] || '#31708f'};
        color: white;
        border-radius: 5px;
        z-index: 10000;
        max-width: 300px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;
    messageDiv.textContent = text;
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.style.opacity = '0';
        messageDiv.style.transition = 'opacity 0.5s';
        setTimeout(() => document.body.removeChild(messageDiv), 500);
    }, 3000);
}

document.getElementById('btn-reset').addEventListener('click', stopCurrentEmulator);

document.getElementById('os-selector').addEventListener('change', function() {
    const btn = document.getElementById('btn-start');
    const selectedText = this.options[this.selectedIndex].text;
    if (this.value) {
        btn.textContent = `Запустить ${selectedText}`;
    } else {
        btn.textContent = 'Запустить эмулятор';
    }
});

// ================== ЗАПУСК ПРИ ЗАГРУЗКЕ СТРАНИЦЫ ==================
// Функция для ожидания загрузки библиотек
function waitForLibrary(libName, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkLibrary = () => {
            if (window[libName]) {
                resolve();
            } else if (Date.now() - startTime > timeout) {
                reject(new Error(`Библиотека ${libName} не загрузилась за ${timeout}мс`));
            } else {
                setTimeout(checkLibrary, 100);
            }
        };
        
        checkLibrary();
    });
}

// Основная функция инициализации
async function initializeApp() {
    try {
        // Ждем загрузки обеих библиотек
        await Promise.all([
            waitForLibrary('vis'),
            waitForLibrary('V86')
        ]);
        
        console.log('Все библиотеки загружены. Инициализируем таймлайн...');
        
        // Инициализируем таймлайн
        await initTimeline();
        
        // Автоматически выбираем первое событие
        if (timelineEvents.length > 0) {
            setTimeout(() => {
                visTimeline.setSelection([timelineEvents[0].id]);
                // Используем обычный вызов, а не await в не-async функции
                handleTimelineSelect({ items: [timelineEvents[0].id] });
            }, 500);
        }
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        showMessage(`Ошибка загрузки: ${error.message}`, 'error');
    }
}

// Запускаем при полной загрузке DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        initializeApp();
    });
} else {
    initializeApp();
}