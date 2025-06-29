/*
 * The Soulforge Saga - The World's Soul (v5.7 - Edisi Mitologi Hidup)
 * Mengintegrasikan narasi dari Gulungan Sang Panggilan ke dalam setiap mekanisme dunia.
 * Ditempa ulang pada Jumat, 20 Juni 2025, sebagai persembahan agung.
 */

// Bagian 1: Impor & Inisialisasi
import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseApp = initializeApp(firebaseConfig);
const firestoreDB = getFirestore(firebaseApp);

// Bagian 2: UIManager (Pembantu Antarmuka)
const UIManager = {
    showLoading(message = "Menempa Realitas...") {
        const loadingScreen = document.getElementById('loading-screen');
        const loadingText = document.getElementById('loading-text');
        if (loadingText) loadingText.textContent = message;
        if (loadingScreen) loadingScreen.classList.add('visible');
    },
    hideLoading() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) loadingScreen.classList.remove('visible');
    },
    render(container, html) {
        if (container) container.innerHTML = html;
        feather.replace();
    },
    showError(element, message) {
        if (element) {
            element.textContent = message;
            element.style.opacity = 1;
        }
    },
    clearError(element) {
        if (element) {
            element.textContent = '';
            element.style.opacity = 0;
        }
    },
    showNotification(text, icon = 'award', colorClass = 'bg-gradient-to-r from-yellow-400 to-amber-400') {
        const banner = document.getElementById('notification-banner');
        const bannerText = document.getElementById('notification-text');
        const bannerIcon = document.getElementById('notification-icon');
        if(!banner || !bannerText || !bannerIcon) return;

        banner.className = `fixed top-0 left-0 right-0 p-4 text-slate-900 font-bold text-center z-50 shadow-lg opacity-0 ${colorClass}`;
        bannerIcon.setAttribute('data-feather', icon);
        feather.replace();

        bannerText.textContent = text;
        banner.classList.add('show');
        banner.style.opacity = 1;

        setTimeout(() => {
            banner.classList.remove('show');
            banner.style.opacity = 0;
        }, 4000);
    },
     showModal(title, text, choices = []) {
        const choiceButtons = choices.map((c, i) => `<button class="modal-choice-btn px-6 py-3 font-semibold rounded-lg ${c.isPrimary ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-slate-700 hover:bg-slate-600'}" data-index="${i}">${c.text}</button>`).join('') || `<button class="modal-choice-btn px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg" data-index="0">Acknowledge</button>`;
        const overlayContainer = document.getElementById('overlay-container');
        
        const modalHTML = `
            <div id="dynamic-modal" class="modal-overlay fixed inset-0 bg-black bg-opacity-80 z-40 flex items-center justify-center p-8 opacity-0">
                <div class="modal-content bg-card-bg w-full max-w-2xl p-10 rounded-2xl shadow-2xl border border-border-color transform scale-95 opacity-0">
                    <h2 class="text-3xl font-serif text-center text-white tracking-wider">${title}</h2>
                    <p class="text-center text-slate-400 mt-4 text-lg leading-relaxed">${text}</p>
                    <div id="choices-list" class="mt-8 flex justify-end space-x-4">${choiceButtons}</div>
                </div>
            </div>`;
        
        overlayContainer.innerHTML = modalHTML;
        const modal = document.getElementById('dynamic-modal');
        const modalContent = modal.querySelector('.modal-content');

        modal.querySelectorAll('.modal-choice-btn').forEach(btn => {
            btn.onclick = () => {
                const choice = choices[btn.dataset.index];
                if(choice) choice.consequence();
                App.closeModal(modal);
            };
        });
        if (choices.length === 0) {
            modal.onclick = () => App.closeModal(modal);
        }
        
        setTimeout(() => { modal.style.opacity = 1; modalContent.style.opacity = 1; modalContent.style.transform = 'scale(1)'; }, 10);
    },

    closeModal(modal, callback = () => {}) {
        const overlayContainer = document.getElementById('overlay-container');
        if(!modal) return;
        const modalContent = modal.querySelector('.modal-content');
        modal.style.opacity = 0;
        if(modalContent) modalContent.style.transform = 'scale(0.95)';
        setTimeout(() => {
            if(overlayContainer) overlayContainer.innerHTML = '';
            callback();
        }, 300);
    }
};

// Bagian 3: Objek App - Jantung Operasi
const App = {
    DB_DOC_ID: 'soulforgeSaga_v2.0_KitabAgung',
    db: {},
    currentUser: null,
    forgerMantra: 'i am the forger',
    destinyClockInterval: null,
    wandererAttributeChart: null,
    pageTemplates: {},

    // Data Desain Game
    SKILL_TREE_DATA: {
        'Stamina': {
            5: { id: 'stamina-5', name: 'Second Wind', description: 'Once per day, when your Alignment is low, gain a small burst of Intention.', icon: 'wind' },
            10: { id: 'stamina-10', name: 'Iron Constitution', description: 'Reduces the negative effects of the Fatigued status.', icon: 'heart' }
        },
        'Discipline': {
            5: { id: 'discipline-5', name: 'Unwavering Will', description: '10% chance to automatically resist a negative Whisper.', icon: 'anchor' },
            10: { id: 'discipline-10', name: 'Focused Intent', description: 'Gain 5% more Intention from all sources.', icon: 'crosshair' }
        },
        'Knowledge': {
            5: { id: 'knowledge-5', name: 'Scholarly Insight', description: '5% chance to gain double XP from reading or learning actions.', icon: 'book-open' }
        },
        'Social': {
            5: { id: 'social-5', name: 'Empathetic Resonance', description: 'Gain a small Intention boost when connecting with others.', icon: 'users' }
        },
        'Focus': {
            5: { id: 'focus-5', name: 'Mindful Eye', description: 'Gain more Essence of Will from daily Rites.', icon: 'eye' }
        }
    },

    async init() {
        UIManager.showLoading("Menghubungi Tenunan Kosmik...");
        await this.loadDB(); // Memuat data DB terlebih dahulu

        const currentPage = document.body.dataset.page;
        this.checkSession(currentPage); // Memeriksa sesi pengguna dan mengatur currentUser jika ada

        // Pindahkan inisialisasi berdasarkan halaman dan currentUser
        // definePageTemplates akan dipanggil di initWandererPage jika currentUser adalah wanderer
        // dan di initForgerPage jika currentUser adalah forger
        
        UIManager.hideLoading();
        
        switch (currentPage) {
            case 'login': 
                this.initLoginPage(); 
                break;
            case 'wanderer': 
                // Pastikan currentUser valid dan sesuai peran sebelum melanjutkan
                if (this.currentUser && this.currentUser.role === 'wanderer') {
                    this.definePageTemplates(); // Definisi template setelah currentUser ada
                    this.initWandererPage(); 
                } else {
                    // Jika sesi tidak valid atau role tidak cocok, arahkan ke login
                    this.logout(); 
                }
                break;
            case 'forger': 
                // Pastikan currentUser valid dan sesuai peran sebelum melanjutkan
                if (this.currentUser && this.currentUser.role === 'forger') {
                    this.definePageTemplates(); // Definisi template setelah currentUser ada
                    this.initForgerPage(); 
                } else {
                    // Jika sesi tidak valid atau role tidak cocok, arahkan ke login
                    this.logout(); 
                }
                break;
            default:
                // Handle case for an unknown page or error state, redirect to login
                this.logout(); 
                break;
        }
    },

    checkSession(currentPage) {
        const sessionUser = sessionStorage.getItem('soulforgeUser');
        if (sessionUser) {
            try {
                this.currentUser = JSON.parse(sessionUser);
                // Jika sudah login dan berada di halaman login, redirect ke halaman peran yang sesuai
                if (currentPage === 'login') {
                    const redirectUrl = this.currentUser.role === 'forger' ? 'forger.html' : 'wanderer.html';
                    window.location.href = redirectUrl;
                }
            } catch(e) {
                // Jika data sesi rusak, hapus dan paksa login
                console.error("Error parsing session user:", e);
                sessionStorage.removeItem('soulforgeUser');
                if (currentPage !== 'login') window.location.href = 'index.html';
            }
        } else {
            // Jika tidak ada sesi, dan tidak di halaman login, arahkan ke halaman login
            if (currentPage !== 'login') {
                window.location.href = 'index.html';
            }
        }
    },

    async loadDB() {
        const docRef = doc(firestoreDB, "saga_worlds", this.DB_DOC_ID);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) { 
            this.db = docSnap.data(); 
        } else {
            const defaultDB = {
                world: {
                    submissionMantra: "dunia baru menanti",
                    cosmicSeason: "none",
                    apotheosisDate: "2028-01-01T00:00:00Z"
                },
                wanderers: {},
            };
            this.db = defaultDB;
            await this.saveDB(false);
        }
    },

    async saveDB(showLoading = true) {
        if (showLoading) UIManager.showLoading("Menyimpan takdir ke awan...");
        // Hanya simpan currentUser jika dia adalah wanderer
        if (this.currentUser && this.currentUser.role === 'wanderer') {
            this.db.wanderers[this.currentUser.name] = this.currentUser;
        }
        const docRef = doc(firestoreDB, "saga_worlds", this.DB_DOC_ID);
        await setDoc(docRef, this.db, { merge: true });
        if (showLoading) UIManager.hideLoading();
    },
    
    // --- Gerbang Takdir & User Logic ---
    initLoginPage() { this.renderLoginGate(); },

    renderLoginGate() {
        const gateContainer = document.getElementById('gate-container');
        const html = `
            <h1 class="font-serif text-5xl text-white tracking-widest" style="text-shadow: 0 0 15px rgba(129, 140, 248, 0.5);">Gerbang Takdir</h1>
            <p class="text-slate-400 text-lg mb-8">Ucapkan Mantra Jiwamu</p>
            <input type="text" id="mantra-input" class="mantra-input" placeholder="...mantra..." autocomplete="off">
            <p id="error-message" class="error-message h-6 mt-4 text-red-400"></p>
            <button id="gate-button" class="threshold-button">Masuk</button>
        `;
        UIManager.render(gateContainer, html);
        document.getElementById('gate-button').onclick = () => this.handleMantra();
        document.getElementById('mantra-input').onkeyup = (e) => { if (e.key === 'Enter') this.handleMantra(); };
    },

    handleMantra() {
        const input = document.getElementById('mantra-input');
        const errorEl = document.getElementById('error-message');
        const mantra = input.value.trim().toLowerCase();

        UIManager.clearError(errorEl);

        if (!mantra) {
            UIManager.showError(errorEl, "Keheningan tidak akan membuka gerbang.");
            return;
        }

        if (mantra === this.forgerMantra) {
            this.loginAsForger();
            return;
        }

        if (mantra === this.db.world.submissionMantra) {
            this.renderNewWandererFlow();
            return;
        }

        const wanderer = Object.values(this.db.wanderers).find(w => w.mantra.toLowerCase() === mantra);
        if (wanderer) {
            this.loginAsWanderer(wanderer.name);
        } else {
            UIManager.showError(errorEl, "Mantra tidak dikenali. Ucapkan dengan benar, atau serahkan dirimu.");
        }
    },

    renderNewWandererFlow() {
        const gateContainer = document.getElementById('gate-container');
        const html = `
            <p class="gate-prompt text-slate-300">Kau telah menjawab panggilan. Ukir Mantra Pribadimu. Ini akan menjadi kunci abadi jiwamu. Ucapkan dengan hati-hati, karena ia tak dapat diubah.</p>
            <input type="password" id="new-mantra-input" class="mantra-input" placeholder="Mantra Pribadi Baru...">
            <p class="gate-prompt text-slate-300 mt-6">Dunia ini merasakan kehadiranmu. Sebutkan namamu, agar ia terukir abadi dalam Tenunan Kosmik.</p>
            <input type="text" id="new-name-input" class="mantra-input" placeholder="Nama Abadi...">
            <p id="error-message" class="error-message h-6 mt-4 text-red-400"></p>
            <button id="forge-soul-button" class="threshold-button">Tempa Jiwaku</button>
        `;
        UIManager.render(gateContainer, html);
        document.getElementById('forge-soul-button').onclick = () => this.handleCreateWanderer();
    },

    async handleCreateWanderer() {
        const mantraInput = document.getElementById('new-mantra-input');
        const nameInput = document.getElementById('new-name-input');
        const errorEl = document.getElementById('error-message');
        const newMantra = mantraInput.value.trim();
        const newName = nameInput.value.trim();

        UIManager.clearError(errorEl);

        if (!newMantra || !newName) {
            UIManager.showError(errorEl, "Mantra dan Nama Abadi tidak boleh kosong.");
            return;
        }
        if (this.db.wanderers[newName]) {
            UIManager.showError(errorEl, `Nama "${newName}" telah terukir. Pilih nama lain.`);
            return;
        }
        if (Object.values(this.db.wanderers).some(w => w.mantra === newMantra)) {
            UIManager.showError(errorEl, "Mantra ini telah menjadi kunci jiwa lain.");
            return;
        }

        await this.createNewWanderer(newName, newMantra);
    },

    async createNewWanderer(name, mantra) {
        UIManager.showLoading("Menempa jiwa baru dalam Tenunan Kosmik...");
        this.db.wanderers[name] = {
            name: name, mantra: mantra, role: 'wanderer', soulRank: 1, title: "The Awakened",
            xp: 0, alignment: { echo: 50, intention: 50 }, consistencyStreak: 0, essenceOfWill: 0,
            status: { id: 'neutral', text: 'Balanced', color: 'text-slate-400' },
            focus: { attribute: null, setOn: null },
            unlockedImprints: [],
            dailyRitual: {
                streak: 0,
                lastRiteDate: null,
                orbs: [
                    { id: 'dawn', name: 'Fajar', ignited: false, window: [4, 7], icon: 'sunrise' },
                    { id: 'noon', name: 'Siang', ignited: false, window: [12, 14], icon: 'sun' },
                    { id: 'afternoon', name: 'Sore', ignited: false, window: [15, 17], icon: 'cloud' },
                    { id: 'dusk', name: 'Senja', ignited: false, window: [18, 19], icon: 'sunset' },
                    { id: 'night', name: 'Malam', ignited: false, window: [20, 22], icon: 'moon' }
                ],
                todaysRite: null
            },
            attributes: [ 
                { name: 'Stamina', value: 2, xp: 0, xpToNext: 100, legendaryRank: 0 }, 
                { name: 'Discipline', value: 2, xp: 0, xpToNext: 100, legendaryRank: 0 }, 
                { name: 'Knowledge', value: 2, xp: 0, xpToNext: 100, legendaryRank: 0 }, 
                { name: 'Social', value: 2, xp: 0, xpToNext: 100, legendaryRank: 0 }, 
                { name: 'Focus', value: 2, xp: 0, xpToNext: 100, legendaryRank: 0 } 
            ],
            divineMandate: null,
            legacyBlessings: [
                 { id: 'blessing1', name: 'Resilience Forge', status: 'Dormant', icon: 'zap' },
                 { id: 'blessing2', name: 'Creative Spark', status: 'Dormant', icon: 'pen-tool'},
            ],
            wordsOfPower: [
                 { id: 'word1', word: 'SADAR', discovered: false },
            ],
            worldMap: {
                size: 10,
                revealedTiles: ['4,4', '4,5', '5,4', '5,5'],
                landmarks: [ { pos: '1,1', name: 'Altar of Self-Truth', wordId: 'word1', discovered: false } ]
            },
            chronicle: [{ id: Date.now(), type: 'genesis', title: 'The Genesis', spoil: 'A New Soul', reflection: `Jiwa ${name} terlahir di Gerbang Takdir.`, timestamp: new Date().toISOString(), sigil: 'compass' }],
            ledger: { transactions: [] }
        };
        await this.saveDB(false);
        this.loginAsWanderer(name); // Login sebagai wanderer baru setelah dibuat
    },

    loginAsForger() {
        UIManager.showLoading("Membuka Takhta Sang Penempa...");
        this.currentUser = { role: 'forger' };
        sessionStorage.setItem('soulforgeUser', JSON.stringify(this.currentUser));
        window.location.href = 'forger.html';
    },

    loginAsWanderer(name) {
        UIManager.showLoading("Membuka Jalan Sang Pengembara...");
        this.currentUser = this.db.wanderers[name];
        sessionStorage.setItem('soulforgeUser', JSON.stringify(this.currentUser));
        window.location.href = 'wanderer.html';
    },

    logout() {
        sessionStorage.removeItem('soulforgeUser');
        if (this.destinyClockInterval) clearInterval(this.destinyClockInterval);
        window.location.href = 'index.html';
    },

    // --- Inisialisasi Halaman Wanderer ---
    initWandererPage() {
        // Cek lagi untuk keamanan, meskipun init() sudah seharusnya memfilter
        if (!this.currentUser || this.currentUser.role !== 'wanderer') {
            this.logout();
            return;
        }
        document.getElementById('wanderer-app').style.display = 'flex';
        document.getElementById('logout-button').onclick = () => this.logout();
        document.getElementById('wanderer-profile-icon').textContent = this.currentUser.name.charAt(0);
        
        this.renderWandererNav();
        this.setupWandererNavEvents();
        this.renderWandererPage('character'); // Default ke halaman karakter
        this.startDestinyClock();
        
        // Interval encounter tetap dikomentari untuk saat ini, aktifkan jika logika sudah ada
        // setInterval(() => this.triggerEncounter(), 30000);
    },
    
    renderWandererNav() {
         const navContainer = document.getElementById('wanderer-nav');
         const navItems = [ 
            { id: 'character', name: 'Character', icon: 'user' },
            { id: 'quest_log', name: 'The Chronicle', icon: 'book-open' },
            { id: 'sanctuary', name: 'Sanctuary', icon: 'shield' },
            { id: 'world_map', name: 'World Map', icon: 'map' },
            { id: 'skill_tree', name: 'Skill Tree', icon: 'git-branch' }
         ];
         const html = navItems.map(item => `
            <a href="#${item.id}" class="wanderer-nav-link sidebar-link flex items-center p-4 rounded-lg" data-page="${item.id}">
                <i data-feather="${item.icon}" class="w-6 h-6"></i>
                <span class="hidden lg:block ml-5 text-lg font-semibold">${item.name}</span>
            </a>
        `).join('');
        UIManager.render(navContainer, html);
    },

    setupWandererNavEvents() {
        const navLinks = document.querySelectorAll('.wanderer-nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const pageId = link.dataset.page;
                this.renderWandererPage(pageId);
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            });
        });
        // Pastikan link "Character" aktif secara default saat pertama kali dimuat
        document.querySelector('.wanderer-nav-link[data-page="character"]').classList.add('active');
    },

    renderWandererPage(pageId) {
        const pageContainer = document.getElementById('wanderer-page-container');
        const headerTitle = document.querySelector('#wanderer-header-title h2');
        let contentHtml = this.pageTemplates[pageId] || this.pageTemplates['character']; // Fallback ke karakter

        // Pastikan chart.js library dimuat jika akan merender chart.
        // Untuk saat ini, kita mengandalkan chart.js yang diimpor di HTML.

        let title = pageId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        headerTitle.textContent = title;
        UIManager.render(pageContainer, contentHtml);
        
        this.renderAllWandererComponents(pageId);
    },

    renderAllWandererComponents(pageId) {
        if (pageId === 'character') {
            this.renderPlayerStatus();
            this.renderWandererScales();
            this.renderWandererAltar();
            this.renderWandererRadarChart(); // Akan ditambahkan implementasinya
            // this.renderWandererMandate(); // Akan dirender sebagai bagian dari komponen detail wanderer
            this.renderAttributeXpBars(); // Akan ditambahkan implementasinya
        } else if (pageId === 'quest_log') {
            this.renderActiveQuestsLog(); // Akan ditambahkan implementasinya
            this.renderChronicle(); // Akan ditambahkan implementasinya
            this.setupQuestLogTabs(); // Akan ditambahkan implementasinya
        } else if (pageId === 'sanctuary') {
            this.renderSanctuary(); // Akan ditambahkan implementasinya
        } else if (pageId === 'world_map') {
            this.renderWorldMap(); // Akan ditambahkan implementasinya
        } else if (pageId === 'skill_tree') {
            this.renderSkillTree(); // Akan ditambahkan implementasinya
        }
        feather.replace();
    },
    
    getWandererCharacterHtml() {
        // Baris ini sekarang aman karena definePageTemplates dipanggil setelah currentUser diatur
        // Tambahkan div untuk Mandate di sini jika ingin menampilkannya di halaman Character
        return `
            <div id="character-page-content" class="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <div class="lg:col-span-2 space-y-8">
                    <div class="bg-card-bg p-8 rounded-2xl shadow-2xl border border-border-color">
                        <div class="text-center">
                            <h3 class="text-4xl font-serif font-bold text-white tracking-wider">${this.currentUser.name}</h3>
                            <p id="wanderer-title" class="text-lg font-semibold text-indigo-400 mt-2"></p>
                             <div id="player-status-container" class="mt-2 text-sm font-semibold h-5"></div>
                        </div>
                        <div class="mt-6 pt-6 border-t border-border-color">
                             <h4 class="text-sm font-bold text-center text-slate-400 uppercase tracking-widest mb-4">The Scales of Conscience</h4>
                             <div id="wanderer-scales-container"></div>
                        </div>
                    </div>
                     <div class="bg-card-bg p-8 rounded-2xl shadow-2xl border border-border-color">
                        <h3 class="text-xl font-serif font-bold text-white mb-2 tracking-wider">The Celestial Altar</h3>
                        <p class="text-slate-400">Perform the daily Rite of Reckoning.</p>
                        <div class="relative h-24 mt-8">
                             <div class="absolute inset-0 border-b-2 border-dashed border-border-color rounded-full"></div>
                             <div id="wanderer-altar-container" class="absolute inset-0 flex justify-between items-center px-2"></div>
                        </div>
                    </div>
                </div>
                <div class="lg:col-span-3 space-y-8">
                    <div class="bg-card-bg p-6 rounded-2xl shadow-2xl border border-border-color">
                        <h3 class="text-xl font-serif font-bold text-white mb-4 tracking-wider">Pentagon of Fate</h3>
                        <div class="w-full max-w-md mx-auto h-64 md:h-80"><canvas id="wanderer-attribute-chart"></canvas></div>
                    </div>
                     <div id="attributes-xp-container" class="bg-card-bg p-6 rounded-2xl shadow-2xl border border-border-color">
                        <h3 class="text-xl font-serif font-bold text-white mb-4 tracking-wider">Soul's Muscle Memory</h3>
                        <div id="attributes-xp-list" class="space-y-4"></div>
                    </div>
                    <div id="wanderer-mandate-container" class="bg-card-bg p-6 rounded-2xl shadow-2xl border border-border-color">
                        <h3 class="text-xl font-serif font-bold text-white mb-4 tracking-wider">Divine Mandate</h3>
                        </div>
                </div>
            </div>`;
    },

    renderPlayerStatus() {
        document.getElementById('wanderer-title').textContent = `Peringkat Jiwa ${this.currentUser.soulRank}: ${this.currentUser.title}`;
        const statusContainer = document.getElementById('player-status-container');
        statusContainer.innerHTML = `<span class="${this.currentUser.status.color}">${this.currentUser.status.text}</span>`;
    },
    
    renderWandererScales() {
        const container = document.getElementById('wanderer-scales-container');
        if (!container) return;
        const { echo, intention } = this.currentUser.alignment;
        const total = echo + intention;
        const intentionRatio = total > 0 ? (intention / total) : 0.5;
        const rotation = (intentionRatio - 0.5) * -20;
         container.innerHTML = `
            <div class="flex items-center justify-between text-xs font-bold uppercase tracking-widest"><span class="text-slate-400">Echo</span><span class="text-indigo-400">Intention</span></div>
            <div class="relative w-full h-10 flex items-center mt-2">
                <div class="scales-beam" id="scales-beam" style="transform: rotate(${rotation}deg)">
                    <div class="scales-pan" id="pan-echo"><i data-feather="zap-off" class="h-4 w-4 text-slate-400"></i></div>
                    <div class="scales-pan" id="pan-intention"><i data-feather="sun" class="h-4 w-4 text-indigo-300"></i></div>
                </div>
            </div>`;
        feather.replace(); // Pastikan ikon feather dirender
    },
    
    renderWandererAltar() {
        const container = document.getElementById('wanderer-altar-container');
        if (!container) return;
        // Logic to determine if orb is within window for dynamic activation
        const now = new Date();
        const currentHour = now.getHours();

        container.innerHTML = this.currentUser.dailyRitual.orbs.map(orb => {
            // Periksa apakah orb berada dalam jendela waktu yang aktif DAN belum dinyalakan
            const isWithinWindow = currentHour >= orb.window[0] && currentHour < orb.window[1];
            const isDisabled = orb.ignited || !isWithinWindow; // Orb disabled jika sudah ignited atau di luar window
            const isActiveWindow = isWithinWindow && !orb.ignited; // Orb aktif jika dalam window dan belum ignited

            return `<div class="orb ${orb.ignited ? 'ignited' : ''} ${isDisabled ? 'disabled' : ''} ${isActiveWindow ? 'active-window' : ''}" data-orb-id="${orb.id}">
                        <i data-feather="${orb.icon}" class="h-6 w-6 ${orb.ignited ? 'text-yellow-700' : 'text-slate-500'}"></i>
                    </div>`;
        }).join('');

        container.querySelectorAll('.orb:not(.disabled)').forEach(orbEl => {
            orbEl.onclick = () => this.showRiteOfReckoning(orbEl.dataset.orbId);
        });
        feather.replace(); // Pastikan ikon feather dirender
    },

    showRiteOfReckoning(orbId) {
        // Mocking a rite for demo
        const rite = {
            prompt: 'An Echo of Impatience arose. How did you respond?',
            choices: [
                { text: 'I gave in and doomscrolled.', intention: 0, echo: 20 },
                { text: 'I resisted and took three deep breaths.', intention: 15, echo: 5, organicXp: { attr: 'Discipline', amount: 2 } },
                { text: 'I used the moment to stand up and stretch.', intention: 25, echo: 0, organicXp: { attr: 'Stamina', amount: 1 } }
            ],
        };

        UIManager.showModal('The Rite of Reckoning', rite.prompt, rite.choices.map(choice => ({
            text: choice.text,
            consequence: async () => { // Gunakan async karena ada saveDB
                this.currentUser.alignment.echo += choice.echo;
                this.currentUser.alignment.intention += choice.intention;
                
                const orb = this.currentUser.dailyRitual.orbs.find(o => o.id === orbId);
                if(orb) orb.ignited = true;

                if(choice.organicXp) {
                    await this.gainAttributeXp(choice.organicXp.attr, choice.organicXp.amount);
                }
                // Simpan perubahan ke DB dan render ulang komponen
                await this.saveDB(false);
                this.renderAllWandererComponents('character'); // Render kembali halaman karakter
            }
        })));
    },
    
    renderWandererMandate() {
        const container = document.getElementById('wanderer-mandate-container');
        if (!container) return;
        const mandate = this.currentUser.divineMandate;
        let html = '';
        if (mandate && !mandate.completed) {
            html = `
                <p class="text-lg font-semibold text-slate-300">${mandate.title}</p>
                <p class="text-slate-400 mb-4">${mandate.description}</p>
                <div class="flex items-center">
                    <input type="checkbox" id="mandate-checkbox" class="h-6 w-6 rounded border-slate-500 text-indigo-500 bg-slate-700 focus:ring-0">
                    <label for="mandate-checkbox" class="ml-3 text-lg">Tandai sebagai selesai (+${mandate.xpReward} XP)</label>
                </div>`;
        } else if (mandate && mandate.completed) {
            html = `<p class="text-slate-500 italic">Anda telah menenun benang takdir ini. Menunggu titah selanjutnya.</p>`;
        } else {
            html = `<p class="text-slate-500 italic">The Primordial Weaver has not yet woven your thread for this cycle.</p>`;
        }
        UIManager.render(container, html);
        if (document.getElementById('mandate-checkbox')) {
            document.getElementById('mandate-checkbox').onchange = async (e) => { // Gunakan async
                if(e.target.checked) await this.completeWandererMandate();
            };
        }
        feather.replace();
    },

    async completeWandererMandate() {
        const mandate = this.currentUser.divineMandate;
        if (!mandate || mandate.completed) return;
        
        mandate.completed = true;
        this.currentUser.xp += mandate.xpReward;
        
        // Simpan perubahan ke DB
        await this.saveDB(true);
        this.renderWandererMandate(); // Render ulang tampilan mandate
        UIManager.showNotification(`Titah telah diselesaikan! Takdirmu bergeser. (+${mandate.xpReward} XP)`, 'check-circle', 'bg-gradient-to-r from-teal-400 to-cyan-400');
        // Panggil juga renderAllWandererComponents untuk update XP di player status
        this.renderAllWandererComponents('character'); 
    },

    async gainAttributeXp(attributeName, amount) {
        const attr = this.currentUser.attributes.find(a => a.name === attributeName);
        if (!attr) return;
        
        const focusBonus = this.currentUser.focus.attribute === attributeName ? 1.5 : 1;
        attr.xp += Math.floor(amount * focusBonus);

        let leveledUp = false;
        if (attr.xp >= attr.xpToNext) {
            const oldLevel = attr.value;
            attr.value++;
            attr.xp -= attr.xpToNext;
            attr.xpToNext = Math.floor(attr.xpToNext * 1.5);
            UIManager.showNotification(`Attribute Increased: ${attributeName} is now Level ${attr.value}!`, 'chevrons-up', 'bg-gradient-to-r from-emerald-400 to-green-400');
            this.checkForNewImprints(attributeName, attr.value);
            leveledUp = true;
        }
        await this.saveDB(false); // Simpan perubahan atribut secara otomatis
        this.renderAttributeXpBars(); // Render ulang bar XP
        if (this.wandererAttributeChart) { // Update radar chart jika sudah diinisialisasi
            this.updateWandererRadarChart();
        }
        return leveledUp; // Mengembalikan boolean jika ada level up
    },
    
    checkForNewImprints(attributeName, newLevel) {
        const skillData = this.SKILL_TREE_DATA[attributeName];
        if (skillData && skillData[newLevel]) {
            const imprint = skillData[newLevel];
            if (!this.currentUser.unlockedImprints.includes(imprint.id)) {
                this.currentUser.unlockedImprints.push(imprint.id);
                UIManager.showNotification(`Soul Imprint Unlocked: ${imprint.name}!`, 'star', 'bg-gradient-to-r from-indigo-500 to-purple-500');
                // Tidak perlu saveDB di sini karena sudah dipanggil di gainAttributeXp
            }
        }
    },

    // Implementasi renderWandererRadarChart
    renderWandererRadarChart() {
        const ctx = document.getElementById('wanderer-attribute-chart');
        if (!ctx) return;

        const attributes = this.currentUser.attributes;
        const labels = attributes.map(attr => attr.name);
        const data = attributes.map(attr => attr.value);

        if (this.wandererAttributeChart) {
            this.wandererAttributeChart.data.labels = labels;
            this.wandererAttributeChart.data.datasets[0].data = data;
            this.wandererAttributeChart.update();
        } else {
            this.wandererAttributeChart = new Chart(ctx, {
                type: 'radar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Attribute Level',
                        data: data,
                        backgroundColor: 'rgba(129, 140, 248, 0.4)', // indigo-400
                        borderColor: 'rgba(129, 140, 248, 1)',
                        borderWidth: 2,
                        pointBackgroundColor: 'rgba(129, 140, 248, 1)',
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: 'rgba(129, 140, 248, 1)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        r: {
                            angleLines: { color: 'rgba(255, 255, 255, 0.2)' },
                            grid: { color: 'rgba(255, 255, 255, 0.2)' },
                            pointLabels: { color: 'rgb(243, 244, 246)', font: { size: 14, family: 'Cormorant Garamond' } },
                            suggestedMin: 0,
                            ticks: {
                                display: false, // Sembunyikan label tick numerik
                                stepSize: 1, // Pastikan tick untuk setiap level
                                color: 'rgba(255, 255, 255, 0.7)'
                            }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `${context.label}: Level ${context.raw}`;
                                }
                            }
                        }
                    }
                }
            });
        }
    },

    updateWandererRadarChart() {
        if (this.wandererAttributeChart) {
            const attributes = this.currentUser.attributes;
            this.wandererAttributeChart.data.datasets[0].data = attributes.map(attr => attr.value);
            this.wandererAttributeChart.update();
        }
    },

    // Implementasi renderAttributeXpBars
    renderAttributeXpBars() {
        const container = document.getElementById('attributes-xp-list');
        if (!container) return;

        const html = this.currentUser.attributes.map(attr => `
            <div class="attribute-xp-item">
                <div class="flex justify-between items-center mb-1">
                    <span class="text-slate-300 font-semibold">${attr.name} (Level ${attr.value})</span>
                    <span class="text-slate-400 text-sm">${attr.xp} / ${attr.xpToNext} XP</span>
                </div>
                <div class="w-full bg-slate-700 rounded-full h-2.5">
                    <div class="bg-brand-color h-2.5 rounded-full" style="width: ${(attr.xp / attr.xpToNext) * 100}%"></div>
                </div>
            </div>
        `).join('');
        UIManager.render(container, html);
    },

    // Implementasi triggerEncounter (Masih placeholder)
    triggerEncounter() {
        if (document.getElementById('overlay-container').innerHTML !== '') return;
        // Logic for triggering random encounters, maybe based on time or actions.
        // Example:
        // UIManager.showModal(
        //     'A Whisper in the Void', 
        //     'The air shimmers, and a cryptic voice echoes in your mind. What do you do?', 
        //     [
        //         { text: 'Embrace the unknown.', consequence: () => console.log('Embraced.') },
        //         { text: 'Resist its influence.', consequence: () => console.log('Resisted.') }
        //     ]
        // );
    },

    startDestinyClock() {
        const clockElement = document.getElementById('destiny-clock');
        if (!clockElement || !this.db.world.apotheosisDate) return;
        const targetDate = new Date(this.db.world.apotheosisDate).getTime();
        this.destinyClockInterval = setInterval(() => {
            const now = new Date().getTime();
            const distance = targetDate - now;
            if (distance < 0) {
                clockElement.innerHTML = "<div>The Final Day has come.</div>";
                clearInterval(this.destinyClockInterval);
                return;
            }
            const years = Math.floor(distance / (1000 * 60 * 60 * 24 * 365.25)); // Use 365.25 for leap years
            const days = Math.floor((distance % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000); // Tambahkan detik untuk akurasi
            clockElement.innerHTML = `
                <div>${String(years).padStart(2, '0')}y : ${String(days).padStart(3, '0')}d</div>
                <div class="text-lg">${String(hours).padStart(2, '0')}h : ${String(minutes).padStart(2, '0')}m : ${String(seconds).padStart(2, '0')}s</div>`;
        }, 1000);
    },
    
    exportSaga() {
        if (!this.currentUser) {
            UIManager.showNotification('Tidak ada data jiwa yang bisa diekspor.', 'x-circle', 'bg-red-500');
            return;
        }
        const dataStr = JSON.stringify(this.currentUser, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = `soulforge_saga_${this.currentUser.name.toLowerCase().replace(/\s/g, '_')}.json`;
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        document.body.appendChild(linkElement); // Append to body is good practice
        linkElement.click();
        document.body.removeChild(linkElement); // Clean up
        UIManager.showNotification('Data Saga berhasil diekspor!', 'download-cloud', 'bg-gradient-to-r from-blue-400 to-purple-400');
    },

    importSaga(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                // Validasi data impor lebih ketat
                if (importedData && typeof importedData.name === 'string' && typeof importedData.mantra === 'string' && importedData.role === 'wanderer' && this.currentUser.name === importedData.name) {
                    UIManager.showLoading('Memulihkan data Saga...');
                    this.db.wanderers[importedData.name] = importedData; // Ganti data wanderer di db
                    this.currentUser = importedData; // Update currentUser
                    await this.saveDB(false); // Simpan perubahan ke Firestore
                    UIManager.hideLoading();
                    UIManager.showNotification('Data Saga berhasil dipulihkan! Halaman akan dimuat ulang.', 'upload-cloud', 'bg-gradient-to-r from-emerald-400 to-green-400');
                    setTimeout(() => window.location.reload(), 1000); // Muat ulang setelah notifikasi
                } else {
                    UIManager.showError(document.getElementById('error-message'), 'File cadangan tidak valid atau bukan milik jiwa ini.');
                    UIManager.showNotification('Gagal impor: File tidak valid atau bukan milik jiwa ini.', 'x-circle', 'bg-red-500');
                }
            } catch (error) {
                console.error("Error importing saga:", error);
                UIManager.showError(document.getElementById('error-message'), 'Gagal membaca file. Pastikan file dalam format JSON yang benar.');
                UIManager.showNotification('Gagal impor: File rusak atau format salah.', 'alert-triangle', 'bg-red-500');
            }
        };
        reader.readAsText(file);
    },

    // --- Inisialisasi Halaman Forger ---
    initForgerPage() {
        if (!this.currentUser || this.currentUser.role !== 'forger') {
            this.logout();
            return;
        }
        document.getElementById('forger-app').style.display = 'flex';
        document.getElementById('logout-button').onclick = () => this.logout();
        
        this.renderForgerNav();
        this.setupForgerNavEvents();
        this.renderForgerPage({ pageId: 'observatory' });
    },

    renderForgerNav() {
        const navContainer = document.getElementById('forger-nav');
        const navItems = [
            { id: 'observatory', name: 'Observatorium', icon: 'eye' },
            { id: 'world_forge', name: 'Tempaan Dunia', icon: 'globe' },
            { id: 'revelations', name: 'Perpustakaan Wahyu', icon: 'book' },
            { id: 'guardians', name: 'Aula Para Penjaga', icon: 'shield' },
        ];
        const html = navItems.map(item => `
            <a href="#${item.id}" class="forger-nav-link sidebar-link flex items-center p-4 rounded-lg" data-page="${item.id}">
                <i data-feather="${item.icon}" class="w-6 h-6"></i>
                <span class="hidden lg:block ml-5 text-lg font-semibold">${item.name}</span>
            </a>
        `).join('');
        UIManager.render(navContainer, html);
    },
    
    setupForgerNavEvents() {
        const navLinks = document.querySelectorAll('.forger-nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const pageId = link.dataset.page;
                this.renderForgerPage({ pageId: pageId });
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            });
        });
        document.querySelector('.forger-nav-link[data-page="observatory"]').classList.add('active');
    },

    renderForgerPage({ pageId, wandererName = null }) {
        this.currentForgerView = pageId;
        const pageContainer = document.getElementById('forger-page-container');
        const headerTitle = document.querySelector('#forger-header-title h2');
        let contentHtml = '';
        let title = '';

        switch(pageId) {
            case 'observatory':
                title = 'Observatorium Kosmik';
                contentHtml = this.getObservatoryHtml();
                break;
            case 'wanderer_detail':
                const wanderer = this.db.wanderers[wandererName];
                if (!wanderer) { // Handle jika wanderer tidak ditemukan
                    title = 'Wanderer Tidak Ditemukan';
                    contentHtml = `<p class="text-slate-400">Jiwa ini tidak ada dalam catatan.</p>`;
                    break;
                }
                title = `Kitab Jiwa: ${wanderer.name}`;
                contentHtml = this.getWandererDetailHtml(wanderer);
                break;
            case 'world_forge':
                title = 'Tempaan Dunia';
                contentHtml = this.getWorldForgeHtml(); // Akan ditambahkan
                break;
            case 'revelations':
                title = 'Perpustakaan Wahyu';
                contentHtml = this.getRevelationsHtml(); // Akan ditambahkan
                break;
            case 'guardians':
                title = 'Aula Para Penjaga';
                contentHtml = this.getGuardiansHtml(); // Akan ditambahkan
                break;
            default:
                title = 'Tidak Ditemukan';
                contentHtml = `<p>Realitas ini belum ditempa.</p>`;
        }
        
        headerTitle.textContent = title;
        UIManager.render(pageContainer, contentHtml);
        
        // Setup event listener spesifik halaman
        if (pageId === 'observatory') {
            this.renderWandererList();
        } else if (pageId === 'wanderer_detail') {
            document.getElementById('back-to-observatory').onclick = () => this.renderForgerPage({ pageId: 'observatory' });
            document.getElementById('forge-mandate-button').onclick = () => this.handleForgeMandate(wandererName);
            // Render mandate di sini jika sudah ada
            const currentMandate = this.db.wanderers[wandererName].divineMandate;
            if (currentMandate) {
                const currentMandateDisplay = document.getElementById('current-mandate-display');
                if (currentMandateDisplay) {
                    currentMandateDisplay.innerHTML = `${currentMandate.title}: ${currentMandate.description} (${currentMandate.completed ? 'Selesai' : 'Aktif'})`;
                }
            }
        }
        feather.replace(); // Pastikan ikon feather dirender
    },
    
    getObservatoryHtml() {
        return `
            <div class="bg-card-bg p-8 rounded-2xl shadow-2xl border border-border-color">
                <h3 class="text-2xl font-serif font-bold text-white tracking-wider mb-6">Papan Peringkat Jiwa</h3>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="border-b border-border-color">
                                <th class="p-4 text-sm font-semibold text-slate-400 uppercase tracking-wider">Nama Abadi</th>
                                <th class="p-4 text-sm font-semibold text-slate-400 uppercase tracking-wider">Peringkat Jiwa</th>
                                <th class="p-4 text-sm font-semibold text-slate-400 uppercase tracking-wider">Gelar</th>
                            </tr>
                        </thead>
                        <tbody id="wanderer-list-body"></tbody>
                    </table>
                </div>
            </div>`;
    },

    renderWandererList() {
        const tbody = document.getElementById('wanderer-list-body');
        const wanderers = Object.values(this.db.wanderers);
        if (wanderers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-slate-500">Belum ada jiwa yang menyerahkan diri pada takdir.</td></tr>`;
            return;
        }
        const rowsHtml = wanderers
            .sort((a, b) => b.soulRank - a.soulRank)
            .map(w => `
                <tr class="border-b border-border-color hover:bg-slate-800 transition-colors cursor-pointer" data-wanderer-name="${w.name}">
                    <td class="p-4 font-bold text-lg text-slate-100">${w.name}</td>
                    <td class="p-4 font-mono text-slate-300">${w.soulRank}</td>
                    <td class="p-4 text-indigo-400 font-semibold">${w.title}</td>
                </tr>
            `).join('');
        tbody.innerHTML = rowsHtml;
        tbody.querySelectorAll('tr').forEach(row => {
            row.addEventListener('click', () => {
                const wandererName = row.dataset.wandererName;
                if(wandererName) this.renderForgerPage({ pageId: 'wanderer_detail', wandererName: wandererName });
            });
        });
    },
    
    getWandererDetailHtml(wanderer) {
        const alignment = wanderer.alignment;
        const total = alignment.echo + alignment.intention;
        const intentionRatio = total > 0 ? (alignment.intention / total * 100).toFixed(1) : 50;
        const currentMandate = wanderer.divineMandate;
        const attributes = ["Stamina", "Discipline", "Knowledge", "Social", "Focus"];
        return `
            <div>
                <button id="back-to-observatory" class="flex items-center text-slate-400 hover:text-white mb-6 transition-colors">
                    <i data-feather="arrow-left" class="w-5 h-5 mr-2"></i>
                    Kembali ke Observatorium
                </button>
                <div class="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <div class="space-y-8">
                        <div class="bg-card-bg p-8 rounded-2xl shadow-2xl border border-border-color">
                            <div class="text-center mb-8">
                                <h3 class="text-4xl font-serif font-bold text-white tracking-wider">${wanderer.name}</h3>
                                <p class="text-lg font-semibold text-indigo-400 mt-2">Peringkat Jiwa ${wanderer.soulRank}: ${wanderer.title}</p>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <h4 class="text-xl font-serif font-bold text-white tracking-wider mb-4">Neraca Nurani</h4>
                                    <div class="bg-slate-800 p-4 rounded-lg">
                                        <div class="w-full bg-slate-700 rounded-full h-2.5 mt-2">
                                            <div class="bg-indigo-500 h-2.5 rounded-full" style="width: ${intentionRatio}%"></div>
                                        </div>
                                        <p class="text-center mt-2 text-sm text-slate-300">${intentionRatio}% Intention</p>
                                    </div>
                                </div>
                                <div>
                                    <h4 class="text-xl font-serif font-bold text-white tracking-wider mb-4">Statistik Jiwa</h4>
                                     <div class="bg-slate-800 p-4 rounded-lg space-y-2 text-sm">
                                        <div class="flex justify-between"><span class="text-slate-400">Total XP:</span><span class="font-mono text-white">${wanderer.xp}</span></div>
                                        <div class="flex justify-between"><span class="text-slate-400">Streak Konsistensi:</span><span class="font-mono text-white">${wanderer.consistencyStreak} Hari</span></div>
                                        <div class="flex justify-between"><span class="text-slate-400">Esensi Niat:</span><span class="font-mono text-white">${wanderer.essenceOfWill}</span></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="bg-card-bg p-8 rounded-2xl shadow-2xl border border-border-color">
                            <h3 class="text-2xl font-serif font-bold text-white tracking-wider mb-6">Atribut Jiwa</h3>
                            <div class="space-y-3">
                                ${wanderer.attributes.map(attr => `
                                    <div class="flex justify-between items-center">
                                        <span class="text-slate-300">${attr.name}:</span>
                                        <span class="font-mono text-white">Level ${attr.value} (XP: ${attr.xp}/${attr.xpToNext})</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    <div class="bg-card-bg p-8 rounded-2xl shadow-2xl border border-border-color">
                        <h3 class="text-2xl font-serif font-bold text-white tracking-wider mb-6">Altar Titah Agung</h3>
                        <div class="mb-6">
                            <h4 class="text-lg font-semibold text-slate-300 mb-2">Titah Aktif</h4>
                            <div id="current-mandate-display" class="p-4 bg-slate-800 rounded-lg text-slate-400 italic">
                                ${currentMandate ? `${currentMandate.title}: ${currentMandate.description} (${currentMandate.completed ? 'Selesai' : 'Aktif'})` : 'Tidak ada titah aktif.'}
                            </div>
                        </div>
                        <h4 class="text-lg font-semibold text-slate-300 mb-2 border-t border-border-color pt-6">Tempa Titah Baru</h4>
                        <div class="space-y-4">
                            <div>
                                <label for="mandate-title" class="text-sm font-bold text-slate-400">Judul Titah</label>
                                <input type="text" id="mandate-title" class="w-full bg-slate-800 border border-border-color rounded-md p-2 mt-1 text-white" placeholder="e.g., Mandate of Stamina">
                            </div>
                            <div>
                                <label for="mandate-desc" class="text-sm font-bold text-slate-400">Deskripsi</label>
                                <textarea id="mandate-desc" class="w-full bg-slate-800 border border-border-color rounded-md p-2 mt-1 text-white" rows="3" placeholder="Jelaskan ujian yang harus ditempuh..."></textarea>
                            </div>
                             <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label for="mandate-attr" class="text-sm font-bold text-slate-400">Atribut Terkait</label>
                                    <select id="mandate-attr" class="w-full bg-slate-800 border border-border-color rounded-md p-2 mt-1 text-white">
                                        ${attributes.map(attr => `<option value="${attr}">${attr}</option>`).join('')}
                                    </select>
                                </div>
                                <div>
                                    <label for="mandate-xp" class="text-sm font-bold text-slate-400">Hadiah XP</label>
                                    <input type="number" id="mandate-xp" class="w-full bg-slate-800 border border-border-color rounded-md p-2 mt-1 text-white" value="100">
                                </div>
                             </div>
                             <button id="forge-mandate-button" class="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-500 transition-colors flex items-center justify-center">
                                <i data-feather="pen-tool" class="w-5 h-5 mr-2"></i>
                                Anugerahkan Titah
                             </button>
                        </div>
                    </div>
                </div>
            </div>`;
    },
    
    async handleForgeMandate(wandererName) {
        const title = document.getElementById('mandate-title').value.trim();
        const description = document.getElementById('mandate-desc').value.trim();
        const attribute = document.getElementById('mandate-attr').value;
        const xpInput = document.getElementById('mandate-xp');
        const xpReward = parseInt(xpInput.value);

        if (!title || !description || !attribute || isNaN(xpReward) || xpReward <= 0) {
            UIManager.showNotification('Judul, Deskripsi, Atribut, dan Hadiah XP (positif) harus diisi.', 'alert-triangle', 'bg-red-500');
            return;
        }
        
        // Pastikan wanderer ada sebelum memodifikasi
        if (!this.db.wanderers[wandererName]) {
            UIManager.showNotification('Wanderer tidak ditemukan.', 'x-circle', 'bg-red-500');
            return;
        }

        // Periksa apakah sudah ada mandate aktif
        if (this.db.wanderers[wandererName].divineMandate && !this.db.wanderers[wandererName].divineMandate.completed) {
            UIManager.showNotification('Wanderer ini sudah memiliki titah aktif. Selesaikan yang sebelumnya dulu.', 'info', 'bg-blue-500');
            return;
        }

        const newMandate = {
            id: `mandate_${Date.now()}`, title: title, description: description,
            attribute: attribute, xpReward: xpReward, completed: false,
            assignedAt: new Date().toISOString()
        };
        this.db.wanderers[wandererName].divineMandate = newMandate;
        UIManager.showLoading("Menganugerahkan titah baru...");
        
        // Langsung update di Firestore path spesifik untuk wanderer ini
        const wandererRef = doc(firestoreDB, "saga_worlds", this.DB_DOC_ID);
        await updateDoc(wandererRef, { [`wanderers.${wandererName}.divineMandate`]: newMandate });
        
        UIManager.hideLoading();
        this.renderForgerPage({ pageId: 'wanderer_detail', wandererName: wandererName }); // Render ulang halaman detail
        UIManager.showNotification('Titah baru telah dianugerahkan!', 'award', 'bg-gradient-to-r from-teal-400 to-emerald-400');
        
        // Reset form
        document.getElementById('mandate-title').value = '';
        document.getElementById('mandate-desc').value = '';
        document.getElementById('mandate-xp').value = '100';
    },

    // Placeholder untuk halaman Forger lainnya
    getWorldForgeHtml() {
        return `
            <div class="bg-card-bg p-8 rounded-2xl shadow-2xl border border-border-color text-center">
                <h3 class="text-2xl font-serif font-bold text-white tracking-wider mb-4">Tempaan Dunia</h3>
                <p class="text-slate-400">Di sinilah dunia itu sendiri dibentuk. Fitur akan datang!</p>
                <i data-feather="tool" class="w-16 h-16 text-slate-600 mt-8"></i>
            </div>
        `;
    },
    getRevelationsHtml() {
        return `
            <div class="bg-card-bg p-8 rounded-2xl shadow-2xl border border-border-color text-center">
                <h3 class="text-2xl font-serif font-bold text-white tracking-wider mb-4">Perpustakaan Wahyu</h3>
                <p class="text-slate-400">Mengelola lore dan peristiwa yang terungkap. Fitur akan datang!</p>
                <i data-feather="book-open" class="w-16 h-16 text-slate-600 mt-8"></i>
            </div>
        `;
    },
    getGuardiansHtml() {
        return `
            <div class="bg-card-bg p-8 rounded-2xl shadow-2xl border border-border-color text-center">
                <h3 class="text-2xl font-serif font-bold text-white tracking-wider mb-4">Aula Para Penjaga</h3>
                <p class="text-slate-400">Mengelola peran dan izin para Penjaga. Fitur akan datang!</p>
                <i data-feather="shield" class="w-16 h-16 text-slate-600 mt-8"></i>
            </div>
        `;
    },

    // Implementasi placeholder untuk halaman Wanderer lainnya
    renderActiveQuestsLog() {
        const container = document.getElementById('active-quests-log-container');
        if (container) {
            container.innerHTML = `
                <p class="text-slate-500 italic">Belum ada alur takdir yang aktif.</p>
                <div class="p-4 bg-slate-800 rounded-lg">
                    <h4 class="text-lg font-semibold text-white">Current Mandate:</h4>
                    <p class="text-slate-400" id="quest-log-mandate-display">${this.currentUser.divineMandate ? `${this.currentUser.divineMandate.title}: ${this.currentUser.divineMandate.description} (${this.currentUser.divineMandate.completed ? 'Selesai' : 'Aktif'})` : 'Tidak ada titah aktif.'}</p>
                </div>
            `;
        }
    },
    renderChronicle() {
        const container = document.getElementById('chronicle-container');
        if (container) {
            if (this.currentUser.chronicle && this.currentUser.chronicle.length > 0) {
                const sortedChronicle = [...this.currentUser.chronicle].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                const html = sortedChronicle.map(entry => {
                    const date = new Date(entry.timestamp).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
                    const time = new Date(entry.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                    return `
                        <div class="chronicle-entry relative pl-10 pb-12">
                            <div class="absolute -left-2 top-0 w-4 h-4 bg-indigo-600 rounded-full border-2 border-border-color"></div>
                            <div class="absolute -left-2 top-0 transform -translate-x-1/2 -translate-y-1/2">
                                ${entry.sigil ? `<i data-feather="${entry.sigil}" class="w-6 h-6 text-indigo-300"></i>` : ''}
                            </div>
                            <h4 class="text-xl font-serif font-bold text-white">${entry.title}</h4>
                            <p class="text-slate-400 text-sm mt-1">${date} ${time}</p>
                            <p class="text-slate-300 mt-2">${entry.reflection}</p>
                            ${entry.spoil ? `<p class="text-slate-500 italic mt-1">Spoiler: ${entry.spoil}</p>` : ''}
                        </div>
                    `;
                }).join('');
                container.innerHTML = html;
            } else {
                container.innerHTML = `<p class="text-center text-slate-500 italic">Kisah Anda belum terukir.</p>`;
            }
        }
        feather.replace();
    },
    setupQuestLogTabs() {
        const tabsContainer = document.getElementById('quest-log-tabs');
        if (!tabsContainer) return;

        tabsContainer.querySelectorAll('.quest-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                tabsContainer.querySelectorAll('.quest-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                document.querySelectorAll('.quest-content').forEach(content => {
                    content.style.display = 'none';
                });
                document.getElementById(tab.dataset.target).style.display = 'block';
            });
        });
        // Aktifkan tab pertama secara default
        document.querySelector('.quest-tab').click();
    },

    renderSanctuary() {
        const container = document.getElementById('wanderer-page-container');
        if (container) {
            container.innerHTML = `
                <div class="bg-card-bg p-8 rounded-2xl shadow-2xl border border-border-color text-center">
                    <h3 class="text-2xl font-serif font-bold text-white tracking-wider mb-4">Sanctuary of Inner Peace</h3>
                    <p class="text-slate-400">Tempat untuk merenung dan menenangkan jiwa. Fitur akan datang!</p>
                    <i data-feather="feather" class="w-16 h-16 text-slate-600 mt-8"></i>
                </div>
            `;
        }
        feather.replace();
    },
    renderWorldMap() {
        const container = document.getElementById('wanderer-page-container');
        if (container) {
            container.innerHTML = `
                <div class="bg-card-bg p-8 rounded-2xl shadow-2xl border border-border-color text-center">
                    <h3 class="text-2xl font-serif font-bold text-white tracking-wider mb-4">The World Map</h3>
                    <p class="text-slate-400">Eksplorasi dunia Soulforge Saga. Fitur akan datang!</p>
                    <i data-feather="map" class="w-16 h-16 text-slate-600 mt-8"></i>
                </div>
            `;
        }
        feather.replace();
    },
    renderSkillTree() {
        const container = document.getElementById('skill-tree-container');
        if (!container) return;

        let html = '';
        const attributes = ["Stamina", "Discipline", "Knowledge", "Social", "Focus"];
        
        attributes.forEach(attrName => {
            const attribute = this.currentUser.attributes.find(a => a.name === attrName);
            const skillData = this.SKILL_TREE_DATA[attrName];
            
            html += `
                <div class="skill-tree-column bg-card-bg p-6 rounded-2xl shadow-lg border border-border-color">
                    <h4 class="text-xl font-serif font-bold text-white mb-4 text-center">${attrName}</h4>
                    <p class="text-slate-400 text-sm mb-4 text-center">Level Saat Ini: <span class="font-bold text-indigo-400">${attribute.value}</span></p>
                    <div class="space-y-4">
            `;

            if (skillData) {
                // Urutkan level skill
                const levels = Object.keys(skillData).map(Number).sort((a, b) => a - b);
                
                levels.forEach(level => {
                    const imprint = skillData[level];
                    const isUnlocked = this.currentUser.unlockedImprints.includes(imprint.id);
                    const canUnlock = attribute.value >= level && !isUnlocked; // Bisa dibuka jika level cukup dan belum dimiliki
                    const isFuture = attribute.value < level;

                    html += `
                        <div class="skill-node p-4 rounded-lg border ${isUnlocked ? 'border-emerald-500 bg-emerald-900/20' : isFuture ? 'border-slate-700 bg-slate-900/10' : 'border-indigo-600 bg-indigo-900/20'} ${isFuture ? 'opacity-50' : ''}">
                            <div class="flex items-center mb-2">
                                <i data-feather="${imprint.icon}" class="w-6 h-6 mr-3 ${isUnlocked ? 'text-emerald-400' : 'text-slate-500'}"></i>
                                <h5 class="text-lg font-semibold ${isUnlocked ? 'text-white' : 'text-slate-300'}">${imprint.name} (Level ${level})</h5>
                            </div>
                            <p class="text-slate-400 text-sm">${imprint.description}</p>
                            ${isUnlocked ? `<span class="mt-2 block text-emerald-400 text-xs font-bold">UNLOCKED</span>` : ''}
                            ${isFuture ? `<span class="mt-2 block text-slate-500 text-xs font-bold">LEVEL ${level} REQUIRED</span>` : ''}
                            ${canUnlock ? `<button class="unlock-imprint-btn mt-3 w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500" data-imprint-id="${imprint.id}">ACTIVATE</button>` : ''}
                        </div>
                    `;
                });
            } else {
                html += `<p class="text-slate-500 text-center">Belum ada imprin untuk atribut ini.</p>`;
            }

            html += `
                    </div>
                </div>
            `;
        });
        
        UIManager.render(container, html);
        feather.replace();

        // Event listeners untuk tombol ACTIVATE (jika ada)
        document.querySelectorAll('.unlock-imprint-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const imprintId = e.target.dataset.imprintId;
                const imprint = Object.values(this.SKILL_TREE_DATA).flatMap(Object.values).find(i => i.id === imprintId);
                
                if (imprint && !this.currentUser.unlockedImprints.includes(imprintId)) {
                    this.currentUser.unlockedImprints.push(imprintId);
                    await this.saveDB(true);
                    UIManager.showNotification(`Soul Imprint Activated: ${imprint.name}!`, 'zap', 'bg-gradient-to-r from-purple-400 to-pink-400');
                    this.renderSkillTree(); // Render ulang skill tree untuk update status
                }
            });
        });
    },

    definePageTemplates() {
        this.pageTemplates = {
            character: this.getWandererCharacterHtml(),
            quest_log: `
                 <div class="border-b border-border-color mb-8">
                    <nav class="flex space-x-8" aria-label="Tabs" id="quest-log-tabs">
                        <button class="quest-tab active py-4 px-1 text-lg font-semibold border-b-2 border-transparent" data-target="active_quests_content">Active Quests</button>
                        <button class="quest-tab py-4 px-1 text-lg font-semibold text-slate-400 hover:text-slate-200 border-b-2 border-transparent" data-target="the_chronicle_content">The Chronicle</button>
                    </nav>
                </div>
                <div id="active_quests_content" class="quest-content active">
                    <div class="bg-card-bg p-8 rounded-2xl shadow-2xl border border-border-color">
                        <h3 class="text-2xl font-serif font-bold text-white tracking-wider mb-6">Active Threads of Fate</h3>
                         <div id="active-quests-log-container" class="space-y-4"></div>
                    </div>
                </div>
                <div id="the_chronicle_content" class="quest-content" style="display: none;">
                    <div class="bg-card-bg p-8 rounded-2xl shadow-2xl border border-border-color">
                         <div class="text-center mb-10">
                            <h3 class="text-4xl font-serif font-bold text-white tracking-wider">The Chronicle of The Soul Weaver</h3>
                            <p class="text-lg text-slate-400 mt-2">A living record of your sepak terjang since the First Day.</p>
                         </div>
                         <div id="chronicle-container" class="space-y-12 relative border-l-2 border-border-color ml-6"></div>
                    </div>
                </div>`,
             skill_tree: `
                <div class="text-center mb-10">
                    <h2 class="text-4xl font-serif font-bold text-white tracking-wider">The Constellation of Imprints</h2>
                    <p class="text-lg text-slate-400 mt-2">As your Attributes grow, new stars are born, granting permanent boons.</p>
                </div>
                <div id="skill-tree-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
                </div>
             `
        };
    }
};

App.init();

// Menambahkan event listener untuk import/export di halaman Wanderer
document.addEventListener('DOMContentLoaded', () => {
    // Pastikan tombol-tombol ini hanya ada di halaman wanderer.html
    const exportButton = document.getElementById('export-button');
    const importInput = document.getElementById('import-input');

    if (exportButton) {
        exportButton.onclick = () => App.exportSaga();
    }
    if (importInput) {
        importInput.onchange = (e) => {
            if (e.target.files.length > 0) {
                App.importSaga(e.target.files[0]);
            }
        };
    }
    // Overlay container untuk modal
    const overlayContainer = document.createElement('div');
    overlayContainer.id = 'overlay-container';
    document.body.appendChild(overlayContainer);

    // Notification banner
    const notificationBanner = document.createElement('div');
    notificationBanner.id = 'notification-banner';
    notificationBanner.className = `fixed top-0 left-0 right-0 p-4 text-slate-900 font-bold text-center z-50 shadow-lg opacity-0`;
    notificationBanner.innerHTML = `
        <div class="flex items-center justify-center">
            <i id="notification-icon" data-feather="award" class="w-6 h-6 mr-3"></i>
            <span id="notification-text"></span>
        </div>
    `;
    document.body.appendChild(notificationBanner);
    feather.replace(); // Pastikan ikon untuk notifikasi dirender

    // Background Canvas untuk index.html
    const backgroundCanvas = document.getElementById('background-canvas');
    if (backgroundCanvas) {
        const ctx = backgroundCanvas.getContext('2d');
        let width = window.innerWidth;
        let height = window.innerHeight;
        backgroundCanvas.width = width;
        backgroundCanvas.height = height;

        window.addEventListener('resize', () => {
            width = window.innerWidth;
            height = window.innerHeight;
            backgroundCanvas.width = width;
            backgroundCanvas.height = height;
        });

        const particles = [];
        const numParticles = 100;

        function Particle(x, y, radius, color, velocity) {
            this.x = x;
            this.y = y;
            this.radius = radius;
            this.color = color;
            this.velocity = velocity;

            this.draw = function() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
                ctx.fillStyle = this.color;
                ctx.fill();
            };

            this.update = function() {
                this.x += this.velocity.x;
                this.y += this.velocity.y;

                if (this.x - this.radius < 0 || this.x + this.radius > width) {
                    this.velocity.x = -this.velocity.x;
                }
                if (this.y - this.radius < 0 || this.y + this.radius > height) {
                    this.velocity.y = -this.velocity.y;
                }
                this.draw();
            };
        }

        function initParticles() {
            for (let i = 0; i < numParticles; i++) {
                const radius = Math.random() * 2 + 1;
                const x = Math.random() * (width - radius * 2) + radius;
                const y = Math.random() * (height - radius * 2) + radius;
                const color = `rgba(129, 140, 248, ${Math.random() * 0.5 + 0.1})`; // Indigo-400
                const velocity = {
                    x: (Math.random() - 0.5) * 0.5,
                    y: (Math.random() - 0.5) * 0.5
                };
                particles.push(new Particle(x, y, radius, color, velocity));
            }
        }

        function animate() {
            requestAnimationFrame(animate);
            ctx.clearRect(0, 0, width, height);

            for (let i = 0; i < particles.length; i++) {
                particles[i].update();
            }

            // Draw lines between nearby particles
            for (let i = 0; i < particles.length; i++) {
                for (let j = i; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < 100) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.lineWidth = 0.5;
                        ctx.strokeStyle = `rgba(129, 140, 248, ${1 - (distance / 100)})`;
                        ctx.stroke();
                    }
                }
            }
        }

        initParticles();
        animate();
    }
});