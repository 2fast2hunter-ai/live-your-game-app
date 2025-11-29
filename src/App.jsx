import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, doc, setDoc, onSnapshot, collection, 
  Timestamp, increment, deleteDoc, runTransaction, 
  getDoc, addDoc, updateDoc, arrayUnion 
} from 'firebase/firestore';
import { 
  CheckCircle, Plus, Target, TrendingUp, DollarSign, 
  Utensils, X, BarChart, Layers, Zap, 
  Hourglass, Lock, Flame, ShoppingBag, Gift, Sword, 
  Skull, Ghost, Sparkles, User, Save, Backpack, Box,
  Frown, Meh, Smile, Star, AlertTriangle, Clock // Clock hinzugefügt
} from 'lucide-react';

// --- DEINE FIREBASE KONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyDDDzE27pqtIond-M41vEDYMy1-vbdG7vQ",
  authDomain: "liveyourgame-eacda.firebaseapp.com",
  projectId: "liveyourgame-eacda",
  storageBucket: "liveyourgame-eacda.firebasestorage.app",
  messagingSenderId: "998731629990",
  appId: "1:998731629990:web:7573286379d0df39eafb67",
  measurementId: "G-5WBBH0LKPW"
};

// Initialisiere Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Error Boundary Component (Fängt Abstürze ab) ---
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("App Crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col justify-center items-center h-screen bg-red-50 p-6 text-center font-sans">
          <div className="bg-white p-8 rounded-2xl shadow-xl border-2 border-red-100 max-w-md">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Uups, ein Fehler!</h2>
            <p className="text-gray-600 mb-4">Die App ist beim Laden abgestürzt. Hier ist der technische Grund:</p>
            <div className="bg-red-100 p-3 rounded-lg text-red-800 text-xs font-mono overflow-auto text-left mb-4">
              {this.state.error && this.state.error.toString()}
            </div>
            <button 
              onClick={() => window.location.reload()} 
              className="bg-red-600 text-white px-6 py-2 rounded-full font-bold hover:bg-red-700 transition-colors"
            >
              Seite neu laden
            </button>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

// --- Konstanten ---
const QUEST_TYPES = {
    daily: { label: 'Täglich', maxShow: 5, xpFactor: 1, goldFactor: 1, dmg: 10, lootBoxChance: 0.3 },
    weekly: { label: 'Wöchentlich', maxShow: 3, xpFactor: 4, goldFactor: 3, dmg: 30, lootBoxChance: 1.0 },
    monthly: { label: 'Monatlich', maxShow: 2, xpFactor: 10, goldFactor: 8, dmg: 100, lootBoxChance: 1.0 },
};

const DIFFICULTY_BASES = {
    easy: { xp: 50, gold: 10, label: 'Einfach' },
    medium: { xp: 100, gold: 25, label: 'Mittel' },
    hard: { xp: 200, gold: 50, label: 'Schwer' },
};

// --- Vordefinierte Inhalte ---
const PREDEFINED_BOSSES = [
    { name: 'Der Innere Schweinehund', maxHp: 100, description: 'Besiege deine Trägheit!' },
    { name: 'Das Chaos-Monster', maxHp: 150, description: 'Bringe Ordnung in dein Leben.' },
    { name: 'Die Deadline-Hydra', maxHp: 200, description: 'Erledige Dringendes, bevor es nachwächst.' },
    { name: 'Der Prokrastinations-Riese', maxHp: 250, description: 'Fange endlich an!' },
    { name: 'Der Papierkram-Drache', maxHp: 120, description: 'Kämpfe dich durch die Bürokratie.' },
    { name: 'Der Schlaf-Räuber', maxHp: 180, description: 'Finde deinen Rhythmus wieder.' }
];

const RARITY_CONFIG = {
    poor: { label: 'Schrott', color: 'text-gray-400', bg: 'bg-gray-50', border: 'border-gray-200', sortOrder: 1 },
    common: { label: 'Gewöhnlich', color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-300', sortOrder: 2 },
    uncommon: { label: 'Ungewöhnlich', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-300', sortOrder: 3 },
    rare: { label: 'Selten', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-300', sortOrder: 4 },
    elite: { label: 'Elite', color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-300', sortOrder: 5 },
    epic: { label: 'Episch', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-300', sortOrder: 6 },
    mythical: { label: 'Mythisch', color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-300', sortOrder: 7 },
    arcane: { label: 'Arkan', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-300', sortOrder: 8 },
    divine: { label: 'Göttlich', color: 'text-sky-600', bg: 'bg-sky-100', border: 'border-sky-400', sortOrder: 9 },
    legendary: { label: 'LEGENDÄR', color: 'text-yellow-600', bg: 'bg-yellow-100', border: 'border-yellow-500 ring-2 ring-yellow-300', sortOrder: 10 },
};

const LOOT_ITEMS = [
    // ITEMS
    { name: 'Fussel', rarity: 'poor', icon: '☁️', type: 'item' },
    { name: 'Kaputter Stiefel', rarity: 'poor', icon: '🥾', type: 'item' },
    { name: 'Apfel', rarity: 'common', icon: '🍎', type: 'item' },
    { name: 'Holzschwert', rarity: 'common', icon: '🗡️', type: 'item' },
    { name: 'Eisenhelm', rarity: 'uncommon', icon: '🪖', type: 'item' },
    { name: 'Heilkräuter', rarity: 'uncommon', icon: '🌿', type: 'item' },
    { name: 'Silberring', rarity: 'rare', icon: '💍', type: 'item' },
    { name: 'Kleiner Heiltrank', rarity: 'rare', icon: '🍷', type: 'item' },
    { name: 'Goldener Schlüssel', rarity: 'elite', icon: '🔑', type: 'item' },
    { name: 'Meisterwerkzeug', rarity: 'elite', icon: '⚒️', type: 'item' },
    { name: 'Drachenschuppe', rarity: 'epic', icon: '🐲', type: 'item' },
    { name: 'Zauberbuch', rarity: 'epic', icon: '📖', type: 'item' },
    { name: 'Phönixfeder', rarity: 'mythical', icon: '🪶', type: 'item' },
    { name: 'Ewiges Feuer', rarity: 'mythical', icon: '🔥', type: 'item' },
    { name: 'Leerenkristall', rarity: 'arcane', icon: '🔮', type: 'item' },
    { name: 'Zeitkapsel', rarity: 'arcane', icon: '⏳', type: 'item' },
    { name: 'Ambrosia', rarity: 'divine', icon: '🏺', type: 'item' },
    { name: 'Blitz des Zeus', rarity: 'divine', icon: '⚡', type: 'item' },
    { name: 'Excalibur', rarity: 'legendary', icon: '⚔️', type: 'item' },
    { name: 'Der Heilige Gral', rarity: 'legendary', icon: '🏆', type: 'item' },
    // AVATARS
    { name: 'Der Glückliche', rarity: 'common', icon: '🙂', type: 'avatar' },
    { name: 'Der Neutrale', rarity: 'common', icon: '😐', type: 'avatar' },
    { name: 'Der Arbeiter', rarity: 'uncommon', icon: '👷', type: 'avatar' },
    { name: 'Der Gärtner', rarity: 'uncommon', icon: '🧑‍🌾', type: 'avatar' },
    { name: 'Der Ninja', rarity: 'rare', icon: '🥷', type: 'avatar' },
    { name: 'Der Detektiv', rarity: 'rare', icon: '🕵️', type: 'avatar' },
    { name: 'Der Roboter', rarity: 'elite', icon: '🤖', type: 'avatar' },
    { name: 'Der Alien', rarity: 'elite', icon: '👽', type: 'avatar' },
    { name: 'Der Magier', rarity: 'epic', icon: '🧙', type: 'avatar' },
    { name: 'Der Zombie', rarity: 'epic', icon: '🧟', type: 'avatar' },
    { name: 'Der Vampir', rarity: 'mythical', icon: '🧛', type: 'avatar' },
    { name: 'Die Fee', rarity: 'mythical', icon: '🧚', type: 'avatar' },
    { name: 'Der Geist', rarity: 'arcane', icon: '👻', type: 'avatar' },
    { name: 'Der Dämon', rarity: 'arcane', icon: '👿', type: 'avatar' },
    { name: 'Der Engel', rarity: 'divine', icon: '👼', type: 'avatar' },
    { name: 'Der König', rarity: 'legendary', icon: '🤴', type: 'avatar' },
    { name: 'Der Drache', rarity: 'legendary', icon: '🐲', type: 'avatar' },
];

const ACHIEVEMENTS = [
    { id: 'streak_nutrition_7', title: 'Kalorien-Starter', description: 'Tracke deine Ernährung 7 Tage in Folge.', target: 7, type: 'nutritionStreak', xpReward: 500, lootBoxReward: 1 },
    { id: 'streak_nutrition_30', title: 'Ernährungs-Guru', description: 'Tracke deine Ernährung einen ganzen Monat (30 Tage) in Folge.', target: 30, type: 'nutritionStreak', xpReward: 2000, lootBoxReward: 5 },
    { id: 'streak_perfect_3', title: 'Fokus-Wochenende', description: 'Erledige an 3 Tagen in Folge alle deine täglichen Quests.', target: 3, type: 'perfectDayStreak', xpReward: 600, lootBoxReward: 2 },
    { id: 'streak_perfect_7', title: 'Wochen-Champion', description: 'Erledige eine Woche lang (7 Tage) JEDEN Tag alle täglichen Quests.', target: 7, type: 'perfectDayStreak', xpReward: 1500, lootBoxReward: 5 },
    { id: 'total_dailies_50', title: 'Fleißiges Bienchen', description: 'Erledige insgesamt 50 tägliche Quests.', target: 50, type: 'totalDailies', xpReward: 1000, lootBoxReward: 3 }
];

const PREDEFINED_DAILY_QUESTS = [
    { id: 'daily_drink_water', title: 'Achte auf deine Wasserzufuhr (1,5L)', difficulty: 'easy' },
    { id: 'daily_read_book', title: 'Lese 15 Minuten in einem Buch', difficulty: 'easy' },
    { id: 'daily_meditate', title: 'Meditiere 10 Minuten lang', difficulty: 'easy' },
    { id: 'daily_tidy_up', title: 'Räume 5 Minuten in einem Bereich auf', difficulty: 'easy' },
    { id: 'daily_stretch', title: 'Führe 10 Minuten Dehnübungen durch', difficulty: 'easy' },
    { id: 'daily_journal', title: 'Schreibe Tagebuch über den Tag', difficulty: 'medium' },
    { id: 'daily_finance_check', title: 'Überprüfe deine Finanzen/Budgets (10 Minuten)', difficulty: 'medium' },
    { id: 'daily_workout_30min', title: '30 Minuten intensives Training', difficulty: 'medium' },
    { id: 'daily_cook_healthy', title: 'Koche eine gesunde Mahlzeit von Grund auf', difficulty: 'medium' },
    { id: 'daily_learn_skill', title: 'Lerne 20 Minuten eine neue Sprache/Fähigkeit', difficulty: 'medium' },
    { id: 'daily_no_screen', title: 'Eine Stunde vor dem Schlafengehen keine Bildschirme', difficulty: 'hard' },
    { id: 'daily_solve_problem', title: 'Arbeite 60 Minuten an einem schwierigen Problem', difficulty: 'hard' },
    { id: 'daily_walk', title: 'Mache einen 20-minütigen Spaziergang', difficulty: 'easy' },
    { id: 'daily_fruit', title: 'Iss zwei Stück Obst', difficulty: 'easy' },
    { id: 'daily_compliment', title: 'Mache jemandem ein ernstes Kompliment', difficulty: 'medium' },
];

const PREDEFINED_WEEKLY_QUESTS = [
    { id: 'weekly_big_workout', title: 'Absolviere 3 Stunden Sport pro Woche', difficulty: 'medium' },
    { id: 'weekly_social_call', title: 'Rufe 3 verschiedene Freunde oder Verwandte an', difficulty: 'easy' },
    { id: 'weekly_budget_review', title: 'Überprüfe und aktualisiere das Wochenbudget', difficulty: 'medium' },
    { id: 'weekly_deep_clean', title: 'Führe eine gründliche Reinigung (z.B. Bad) durch', difficulty: 'hard' },
    { id: 'weekly_learning', title: 'Nimm an einem Online-Kurs teil (2h)', difficulty: 'hard' },
];

const PREDEFINED_MONTHLY_QUESTS = [
    { id: 'monthly_finances', title: 'Führe eine detaillierte Monatsbilanz der Finanzen durch', difficulty: 'hard' },
    { id: 'monthly_declutter', title: 'Befreie eine Kiste von unnötigem Kram und spende/verkaufe sie', difficulty: 'medium' },
    { id: 'monthly_skill_review', title: 'Reflektiere deinen Fortschritt in einer neuen Fähigkeit', difficulty: 'easy' },
    { id: 'monthly_health_check', title: 'Vereinbare Vorsorgetermin/überprüfe Blutwerte', difficulty: 'hard' },
    { id: 'monthly_book', title: 'Lese ein komplettes Buch', difficulty: 'hard' },
];

// --- Helfer-Funktionen ---
const shuffleArray = (array) => {
    let newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
    d.setDate(diff); d.setHours(0, 0, 0, 0); return d;
};

const getStartOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

const isCompletedThisWeek = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const now = new Date();
    return date.getTime() >= getStartOfWeek(now).getTime();
};

const isCompletedThisMonth = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
};

const calculateLevelProgress = (xp) => {
    let level = 1;
    let xpForNextLevel = 100;
    while (xp >= xpForNextLevel) {
        level++;
        xpForNextLevel += level * 100;
    }
    const xpForCurrentLevel = 50 * (level - 1) * (level - 2) + (level - 1) * 100;
    const currentLevelXP = xp - xpForCurrentLevel;
    const requiredXP = xpForNextLevel - xpForCurrentLevel;
    const progressPercentage = (currentLevelXP / requiredXP) * 100;
    return { level, progressPercentage: Math.min(100, progressPercentage), xpToNextLevel: requiredXP - currentLevelXP };
};

const getRewards = (type, difficulty) => {
    const base = DIFFICULTY_BASES[difficulty] || DIFFICULTY_BASES['medium'];
    const factors = QUEST_TYPES[type] || { xpFactor: 1, goldFactor: 1, dmg: 10, lootBoxChance: 0 };
    return { 
        xp: base.xp * factors.xpFactor, 
        gold: base.gold * factors.goldFactor, 
        dmg: factors.dmg, 
        lootBoxChance: factors.lootBoxChance,
        label: base.label 
    };
};

const generateLootItem = () => {
    const roll = Math.random() * 100;
    let rarity = 'poor';
    if (roll > 99.9) rarity = 'legendary';
    else if (roll > 99.5) rarity = 'divine';
    else if (roll > 98.0) rarity = 'arcane';
    else if (roll > 95.0) rarity = 'mythical';
    else if (roll > 90.0) rarity = 'epic';
    else if (roll > 80.0) rarity = 'elite';
    else if (roll > 65.0) rarity = 'rare';
    else if (roll > 45.0) rarity = 'uncommon';
    else if (roll > 20.0) rarity = 'common';
    
    const pool = LOOT_ITEMS.filter(i => i.rarity === rarity);
    if (pool.length === 0) return { name: 'Nichts', rarity: 'poor', icon: '💨', type: 'item' };
    const item = pool[Math.floor(Math.random() * pool.length)];
    return { ...item, obtainedAt: Date.now() }; 
};

// --- Firestore Helper ---
const getUserStatsDocRef = (db, userId) => doc(db, 'users', userId, 'stats', 'user_stats');
const getTasksCollectionRef = (db, userId) => collection(db, 'users', userId, 'tasks');
const getSelectionsDocRef = (db, userId) => doc(db, 'users', userId, 'sys', 'quest_selections');
const getBossesCollectionRef = (db, userId) => collection(db, 'users', userId, 'bosses');
const getInventoryCollectionRef = (db, userId) => collection(db, 'users', userId, 'inventory');
const getMoodCollectionRef = (db, userId) => collection(db, 'users', userId, 'moods');

// --- UI Components ---
const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-full min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-indigo-500"></div>
        <p className="ml-4 text-gray-500 font-medium">Lade dein Abenteuer...</p>
    </div>
);

const ErrorDisplay = ({ message }) => (
    <div className="flex flex-col justify-center items-center h-full min-h-screen bg-red-50 p-6 text-center">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-red-800 mb-2">Verbindungsfehler</h2>
        <p className="text-red-600 max-w-md">{message}</p>
        <p className="text-sm text-red-400 mt-4">Tipp: Aktiviere in der Firebase Console unter Authentication "Anonym" und in Firestore Rules "allow read, write".</p>
    </div>
);

const NotificationToast = ({ notification }) => {
    const { message, type, visible } = notification;
    if (!visible) return null;
    const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
    const Icon = type === 'success' ? CheckCircle : X;
    return (
        <div className="fixed top-4 right-4 z-50 animate-bounce">
            <div className={`flex items-center ${bgColor} text-white text-sm font-bold px-6 py-4 rounded-xl shadow-2xl`}>
                <Icon className="w-5 h-5 mr-3" />
                <span>{message}</span>
            </div>
        </div>
    );
};

const QuestTimer = ({ type }) => {
    const [timeLeft, setTimeLeft] = useState('');
    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = new Date();
            let target = new Date();
            if (type === 'daily') target.setHours(24, 0, 0, 0);
            else if (type === 'weekly') {
                const day = now.getDay();
                target.setDate(now.getDate() + (day === 0 ? 1 : 8 - day));
                target.setHours(0, 0, 0, 0);
            } else if (type === 'monthly') {
                target = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                target.setHours(0, 0, 0, 0);
            } else return null;
            const diff = target - now;
            if (diff <= 0) return "Reset...";
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            return days > 0 ? `${days}T ${hours}h` : `${hours}h ${minutes}m`;
        };
        setTimeLeft(calculateTimeLeft());
        const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 60000);
        return () => clearInterval(timer);
    }, [type]);
    return timeLeft ? <span className="font-mono text-xs text-indigo-600 bg-indigo-100 px-2 py-1 rounded border border-indigo-200">{timeLeft}</span> : null;
};

const Sidebar = ({ currentView, setCurrentView, userId }) => {
    const navItems = [
        { id: 'dashboard', name: 'Dashboard', icon: BarChart },
        { id: 'adventure', name: 'Abenteuer', icon: Sword },
        { id: 'tasks', name: 'Ziele & Quests', icon: Target },
        { id: 'nutrition', name: 'Ernährung', icon: Utensils },
        { id: 'inventory', name: 'Inventar', icon: Backpack }, 
        { id: 'profile', name: 'Profil', icon: User },
    ];
    return (
        <div className="w-full md:w-64 bg-gray-900 text-white p-4 space-y-2 flex flex-col shadow-xl z-20">
            <div className="text-2xl font-bold mb-8 text-indigo-400 flex items-center px-2"><Layers className="w-8 h-8 mr-3" /> LifeQuest</div>
            {navItems.map((item) => (
                <button key={item.id} onClick={() => setCurrentView(item.id)} className={`flex items-center p-3 rounded-xl transition-all duration-200 ${currentView === item.id ? 'bg-indigo-600 text-white shadow-lg translate-x-1 font-bold' : 'text-gray-400 hover:bg-gray-800 hover:text-white'} text-left`}>
                    <item.icon className="w-5 h-5 mr-3" />
                    <span className="font-medium">{item.name}</span>
                </button>
            ))}
            <div className="mt-auto pt-6 border-t border-gray-800"><p className="text-xs text-gray-500 truncate px-2">ID: {userId?.substring(0,8)}...</p></div>
        </div>
    );
};

const Header = ({ stats, levelStats, inventory }) => {
    const safeStats = stats || { avatar: '👤', displayName: 'Held', lootBoxes: 0, level: 1, xp: 0, gold: 0 };
    const safeInventory = inventory || [];
    const safeLevelStats = levelStats || { progressPercentage: 0, xpToNextLevel: 100 };

    return (
        <header className="bg-white shadow-sm p-4 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 sticky top-0 z-10 border-b border-gray-100">
            <h1 className="text-xl font-bold text-gray-800 flex items-center">
                <span className="mr-3 text-3xl bg-gray-100 rounded-full p-1 border border-gray-200">{safeStats.avatar}</span> 
                <span>Hallo, {safeStats.displayName}!</span>
            </h1>
            <div className="flex flex-wrap justify-center items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
                    <Backpack className="w-4 h-4 text-indigo-500" />
                    <span className="font-medium">{safeInventory.length} Items</span>
                </div>
                <div className="flex items-center bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200 shadow-sm" title="Lootboxen">
                    <Box className="w-4 h-4 mr-2 text-amber-600 animate-pulse" />
                    <span className="text-amber-900 font-bold">{safeStats.lootBoxes} Boxen</span>
                </div>
                <div className="flex items-center bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100 shadow-sm">
                    <TrendingUp className="w-4 h-4 mr-2 text-indigo-600" />
                    <span className="text-indigo-900 font-bold">Lvl {safeStats.level}</span>
                </div>
                <div className="flex flex-col items-end gap-1 min-w-[120px]">
                    <div className="flex justify-between w-full text-xs text-gray-500 font-medium px-1"><span>{safeStats.xp} XP</span><span>Next: {safeLevelStats.xpToNextLevel + safeStats.xp}</span></div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden border border-gray-300 shadow-inner"><div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-700 ease-out" style={{ width: `${safeLevelStats.progressPercentage}%` }}></div></div>
                </div>
            </div>
        </header>
    );
};

const ProfileView = ({ db, userId, stats, showNotification }) => {
    const [name, setName] = useState(stats.displayName || '');
    const [title, setTitle] = useState(stats.title || '');
    const [bio, setBio] = useState(stats.bio || '');
    const [avatar, setAvatar] = useState(stats.avatar || '👤');
    const availableAvatars = stats.unlockedAvatars || ['👤'];

    const saveProfile = async () => {
        try { await updateDoc(getUserStatsDocRef(db, userId), { displayName: name, title: title, bio: bio, avatar: avatar }); showNotification('Profil gespeichert!', 'success'); } 
        catch (e) { showNotification('Fehler beim Speichern.', 'error'); }
    };

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-8">
            <h2 className="text-3xl font-extrabold text-gray-800 flex items-center"><User className="w-8 h-8 mr-3 text-indigo-600" /> Dein Profil</h2>
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center text-6xl mb-6 border-4 border-indigo-100 shadow-lg">{avatar}</div>
                    <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Avatar wählen</label>
                    <div className="flex gap-3 flex-wrap justify-center p-4 bg-gray-50 rounded-2xl border border-gray-200">
                        {availableAvatars.map((a, idx) => (
                            <button key={idx} onClick={() => setAvatar(a)} className={`text-3xl w-12 h-12 flex items-center justify-center rounded-xl transition-all ${avatar === a ? 'bg-white border-2 border-indigo-500 shadow-md transform scale-110' : 'hover:bg-white hover:shadow-sm border-2 border-transparent'}`}>{a}</button>
                        ))}
                    </div>
                </div>
                <div className="space-y-5">
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">Helden-Name</label><input type="text" className="w-full p-4 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-200" value={name} onChange={e => setName(e.target.value)} /></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">Titel</label><input type="text" className="w-full p-4 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-200" value={title} onChange={e => setTitle(e.target.value)} /></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">Mission (Bio)</label><textarea className="w-full p-4 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-200 h-32 resize-none" value={bio} onChange={e => setBio(e.target.value)} /></div>
                    <button onClick={saveProfile} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg active:scale-95 flex items-center justify-center text-lg"><Save className="w-5 h-5 mr-2" /> Speichern</button>
                </div>
            </div>
        </div>
    );
};

const AdventureView = ({ db, userId, showNotification }) => {
    const [bosses, setBosses] = useState([]);
    const [selectedPredefinedBoss, setSelectedPredefinedBoss] = useState(PREDEFINED_BOSSES[0]);

    useEffect(() => {
        if (!db || !userId) return;
        const unsub = onSnapshot(getBossesCollectionRef(db, userId), snap => setBosses(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => unsub();
    }, [db, userId]);

    const createBoss = async () => {
        if (!selectedPredefinedBoss) return;
        if (bosses.some(b => b.active && b.currentHp > 0)) { showNotification('Du kämpfst bereits gegen einen Boss!', 'error'); return; }
        await addDoc(getBossesCollectionRef(db, userId), {
            name: selectedPredefinedBoss.name, maxHp: selectedPredefinedBoss.maxHp, currentHp: selectedPredefinedBoss.maxHp,
            description: selectedPredefinedBoss.description, active: true, createdAt: Timestamp.now()
        });
        showNotification(`${selectedPredefinedBoss.name} beschworen!`, 'success');
    };

    const deleteBoss = async (id) => { await deleteDoc(doc(getBossesCollectionRef(db, userId), id)); };
    const activeBoss = bosses.find(b => b.active && b.currentHp > 0);

    return (
        <div className="p-6 space-y-8 max-w-4xl mx-auto">
            <h2 className="text-3xl font-extrabold text-gray-800 flex items-center"><Sword className="w-8 h-8 mr-3 text-red-600" /> Abenteuer Zone</h2>
            {activeBoss ? (
                <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
                    <Ghost className="absolute right-0 bottom-0 w-64 h-64 text-gray-700 opacity-20 -mr-10 -mb-10 animate-pulse" />
                    <div className="relative z-10">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-3xl font-black text-red-500 tracking-wider uppercase">{activeBoss.name}</h3>
                            <div className="bg-black/30 px-4 py-2 rounded-lg backdrop-blur-sm border border-white/10"><span className="font-mono text-2xl font-bold">{activeBoss.currentHp}</span> <span className="text-gray-400 text-sm ml-1">/ {activeBoss.maxHp} HP</span></div>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-6 mb-4 overflow-hidden border border-gray-600"><div className="bg-gradient-to-r from-red-600 to-orange-500 h-full transition-all duration-700 ease-out" style={{ width: `${(activeBoss.currentHp / activeBoss.maxHp) * 100}%` }}></div></div>
                        <p className="text-gray-300 italic text-sm mb-2">{activeBoss.description}</p>
                        <p className="text-gray-400 text-xs">Erledige Aufgaben für Schaden! (Daily: 10, Weekly: 30, Monthly: 100)</p>
                    </div>
                </div>
            ) : (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-4">Nächsten Gegner wählen</h3>
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                            <select className="w-full p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-200 border border-gray-200" onChange={(e) => setSelectedPredefinedBoss(PREDEFINED_BOSSES.find(b => b.name === e.target.value))} value={selectedPredefinedBoss?.name || ''}>
                                {PREDEFINED_BOSSES.map(b => <option key={b.name} value={b.name}>{b.name} (HP: {b.maxHp})</option>)}
                            </select>
                        </div>
                        <button onClick={createBoss} className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg active:scale-95 w-full md:w-auto">Beschwören</button>
                    </div>
                </div>
            )}
            {bosses.length > 0 && (
                <div className="grid gap-4">
                    <h4 className="font-bold text-gray-600 mt-4">Friedhof</h4>
                    {bosses.filter(b => !b.active || b.currentHp <= 0).map(boss => (
                        <div key={boss.id} className="flex justify-between items-center p-4 bg-gray-100 rounded-xl opacity-70">
                            <span className="font-medium text-gray-700 line-through">{boss.name}</span>
                            <div className="flex items-center gap-4"><span className="text-xs font-bold text-green-600 uppercase">Besiegt</span><button onClick={() => deleteBoss(boss.id)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button></div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const InventoryView = ({ db, userId, stats, inventory, showNotification }) => {
    const [openedItem, setOpenedItem] = useState(null);
    const [isOpening, setIsOpening] = useState(false);

    const openLootBox = async () => {
        if (!stats.lootBoxes || stats.lootBoxes <= 0) { showNotification('Keine Lootboxen!', 'error'); return; }
        setIsOpening(true); setOpenedItem(null);
        setTimeout(async () => {
            const newItem = generateLootItem();
            try {
                await runTransaction(db, async (t) => {
                    const statsRef = getUserStatsDocRef(db, userId);
                    const statsSnap = await t.get(statsRef);
                    if ((statsSnap.data().lootBoxes || 0) <= 0) throw new Error("Keine Boxen");
                    t.update(statsRef, { lootBoxes: increment(-1) });
                    if (newItem.type === 'avatar') {
                        const currentAvatars = statsSnap.data().unlockedAvatars || ['👤'];
                        if (currentAvatars.includes(newItem.icon)) {
                            t.update(statsRef, { gold: increment(100) });
                            newItem.isDuplicate = true;
                        } else {
                            t.update(statsRef, { unlockedAvatars: arrayUnion(newItem.icon) });
                        }
                    } else {
                        t.set(doc(getInventoryCollectionRef(db, userId)), newItem);
                    }
                });
                setOpenedItem(newItem);
                if (newItem.type === 'avatar') {
                    if (newItem.isDuplicate) showNotification(`Duplikat: ${newItem.name}! +100 Gold`, 'success');
                    else showNotification(`Neuer Avatar: ${newItem.icon}!`, 'success');
                } else showNotification(`Gefunden: ${newItem.name}!`, 'success');
            } catch (e) { showNotification('Fehler beim Öffnen.', 'error'); } finally { setIsOpening(false); }
        }, 1500);
    };

    const LootItemCard = ({ item }) => {
        const config = RARITY_CONFIG[item.rarity];
        return (
            <div className={`flex flex-col items-center p-4 rounded-xl border-2 ${config.border} ${config.bg} shadow-sm transition-transform hover:scale-105`}>
                <div className="text-4xl mb-2">{item.icon}</div>
                <div className={`font-bold text-sm ${config.color} mb-1 text-center`}>{item.name}</div>
                <div className="text-xs text-gray-500 uppercase font-semibold">{config.label}</div>
            </div>
        );
    };

    const sortedInventory = [...inventory].sort((a, b) => (RARITY_CONFIG[b.rarity]?.sortOrder || 0) - (RARITY_CONFIG[a.rarity]?.sortOrder || 0));

    return (
        <div className="p-6 space-y-8 max-w-5xl mx-auto">
            <h2 className="text-3xl font-extrabold text-gray-800 flex items-center"><Backpack className="w-8 h-8 mr-3 text-indigo-600" /> Dein Inventar</h2>
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-8 text-white shadow-xl text-center relative overflow-hidden">
                <Sparkles className="absolute top-0 left-0 w-full h-full text-white opacity-10 animate-pulse" />
                <div className="relative z-10">
                    <h3 className="text-2xl font-bold mb-4">Lootbox öffnen</h3>
                    <div className="flex justify-center items-center mb-6"><Box className={`w-24 h-24 text-yellow-300 ${isOpening ? 'animate-bounce' : ''}`} /></div>
                    {openedItem ? (
                        <div className="animate-fade-in-up mb-6 bg-white/10 p-4 rounded-xl backdrop-blur-md border border-white/20 inline-block">
                            <p className="text-gray-200 text-sm mb-2">Du hast erhalten:</p>
                            <div className="text-4xl mb-2">{openedItem.icon}</div>
                            <div className={`text-xl font-bold ${RARITY_CONFIG[openedItem.rarity].color.replace('text-', 'text-white ')} drop-shadow-md`}>{openedItem.name}</div>
                            <div className="text-sm text-gray-300 uppercase mt-1 font-bold">{RARITY_CONFIG[openedItem.rarity].label} {openedItem.type === 'avatar' ? '(Avatar)' : ''}</div>
                            {openedItem.isDuplicate && <div className="text-xs text-yellow-300 mt-1">Duplikat! In Gold umgewandelt.</div>}
                        </div>
                    ) : <p className="text-indigo-100 mb-6 font-medium">Du hast {stats.lootBoxes || 0} ungeöffnete Boxen.</p>}
                    <button onClick={openLootBox} disabled={isOpening || !stats.lootBoxes} className={`px-8 py-3 rounded-full font-bold text-lg shadow-lg active:scale-95 ${!stats.lootBoxes ? 'bg-gray-500 cursor-not-allowed opacity-50' : 'bg-yellow-400 text-yellow-900 hover:bg-yellow-300'}`}>{isOpening ? 'Öffnet...' : 'Box öffnen!'}</button>
                </div>
            </div>
            <div className="space-y-4">
                <h3 className="text-xl font-bold text-gray-700">Gegenstände ({inventory.length})</h3>
                {inventory.length > 0 ? <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">{sortedInventory.map((item, idx) => <LootItemCard key={idx} item={item} />)}</div> : <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-300 text-gray-500">Dein Rucksack ist leer.</div>}
            </div>
        </div>
    );
};

const TasksView = ({ db, userId, stats, activeQuests, completeTask, claimAchievement, showNotification }) => {
    const [activeTab, setActiveTab] = useState('daily');
    const filteredQuests = activeQuests.filter(q => q.type === activeTab);
    const claimedAchievements = stats.achievements || {};

    const AchievementItem = ({ achievement }) => {
        let current = 0;
        if (achievement.type === 'nutritionStreak') current = stats.nutritionStreak || 0;
        if (achievement.type === 'perfectDayStreak') current = stats.perfectDayStreak || 0;
        if (achievement.type === 'totalDailies') current = stats.totalDailyQuestsCompleted || 0;
        const isUnlocked = current >= achievement.target;
        const isClaimed = claimedAchievements[achievement.id];
        const progress = Math.min(100, (current / achievement.target) * 100);

        return (
            <div className={`p-4 bg-white rounded-xl border ${isClaimed ? 'border-green-200 bg-green-50' : 'border-gray-200'} shadow-sm`}>
                <div className="flex justify-between mb-2">
                    <div><h4 className="font-bold text-gray-800 flex items-center">{achievement.title} {isClaimed && <CheckCircle className="w-4 h-4 text-green-500 ml-2" />}</h4><p className="text-sm text-gray-500">{achievement.description}</p></div>
                    <div className="text-right text-xs"><div className="font-bold text-indigo-600">+{achievement.xpReward} XP</div><div className="font-bold text-yellow-600">+{achievement.lootBoxReward} Boxen</div></div>
                </div>
                <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1 font-medium text-gray-600"><span>Fortschritt</span><span>{current} / {achievement.target}</span></div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 mb-3"><div className={`h-2.5 rounded-full transition-all duration-500 ${isUnlocked ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: `${progress}%` }}></div></div>
                    {isClaimed ? <button disabled className="w-full py-2 bg-gray-200 text-gray-500 rounded-lg text-sm font-medium cursor-not-allowed">Bereits abgeholt</button> : isUnlocked ? <button onClick={() => claimAchievement(achievement)} className="w-full py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-bold shadow-md animate-pulse">Abholen!</button> : <button disabled className="w-full py-2 bg-gray-100 text-gray-400 rounded-lg text-sm font-medium cursor-not-allowed">Gesperrt</button>}
                </div>
            </div>
        );
    };

    const TaskItem = ({ task, taskId }) => {
        const rewards = getRewards(task.type, task.difficulty);
        return (
            <div className={`flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border transition-all duration-200 ${task.isCompleted ? 'bg-green-50 border-green-200 opacity-80' : 'bg-white border-gray-200 hover:shadow-md'}`}>
                <div className="flex-1 mb-3 md:mb-0">
                    <div className="flex items-center mb-1"><p className={`font-semibold ${task.isCompleted ? 'text-gray-500 line-through decoration-2' : 'text-gray-800'}`}>{task.title}</p>{task.isCompleted && <CheckCircle className="w-5 h-5 text-green-500 ml-2" />}</div>
                    <div className="flex flex-wrap items-center text-xs text-gray-500 gap-3">
                        <span className="flex items-center bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100"><Zap className="w-3 h-3 mr-1" />{rewards.xp} XP</span>
                        {rewards.lootBoxChance > 0 && <span className="flex items-center bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded border border-yellow-100"><Box className="w-3 h-3 mr-1" />{(rewards.lootBoxChance * 100).toFixed(0)}% Box</span>}
                        <span className="flex items-center bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-100"><Sword className="w-3 h-3 mr-1" />{rewards.dmg} DMG</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {task.isCompleted ? <div className="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium flex items-center"><Clock className="w-4 h-4 mr-2" /><span><QuestTimer type={task.type} /></span></div> : <button onClick={() => completeTask(taskId, task)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm active:transform active:scale-95 transition-all flex items-center"><CheckCircle className="w-4 h-4 mr-2" />Abschließen</button>}
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4"><h2 className="text-2xl font-bold text-gray-800">Quest Tafel</h2>{activeTab !== 'achievements' && <div className="text-sm font-medium text-gray-500">Reset in: <QuestTimer type={activeTab} /></div>}</div>
            <div className="flex p-1 bg-gray-200 rounded-xl overflow-x-auto">{[...Object.keys(QUEST_TYPES), 'achievements'].map(type => <button key={type} onClick={() => setActiveTab(type)} className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === type ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{type === 'achievements' ? 'Meilensteine' : QUEST_TYPES[type].label}</button>)}</div>
            {activeTab !== 'achievements' ? <div className="space-y-3">{filteredQuests.length > 0 ? filteredQuests.map(t => <TaskItem key={t.id} taskId={t.completionDocId || t.id} task={t} />) : <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300 text-gray-500">Warte auf neue Quests...</div>}</div> : <div className="grid md:grid-cols-2 gap-4">{ACHIEVEMENTS.map(ach => <AchievementItem key={ach.id} achievement={ach} />)}</div>}
        </div>
    );
};

const MoodWidget = ({ db, userId, onMoodLogged }) => {
    const [rating, setRating] = useState(0);
    const [note, setNote] = useState('');
    const [hasLoggedToday, setHasLoggedToday] = useState(false);

    useEffect(() => {
        if (!db || !userId) return;
        const today = new Date().toISOString().slice(0, 10);
        const q = doc(getMoodCollectionRef(db, userId), today);
        getDoc(q).then(snap => {
            if (snap.exists()) setHasLoggedToday(true);
        });
    }, [db, userId]);

    const submitMood = async () => {
        if (rating === 0) return;
        const today = new Date().toISOString().slice(0, 10);
        try {
            await setDoc(doc(getMoodCollectionRef(db, userId), today), {
                rating, note, date: Timestamp.now()
            });
            await onMoodLogged(); 
            setHasLoggedToday(true);
        } catch (e) { console.error(e); }
    };

    if (hasLoggedToday) return null;

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 mb-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full -mr-8 -mt-8 z-0"></div>
            <h3 className="text-lg font-bold text-gray-800 mb-3 relative z-10">Wie war dein Tag?</h3>
            <div className="flex gap-2 mb-3 relative z-10">
                {[1, 2, 3, 4, 5].map(r => (
                    <button key={r} onClick={() => setRating(r)} className={`p-2 rounded-lg transition-transform hover:scale-110 ${rating === r ? 'bg-indigo-100 ring-2 ring-indigo-300' : 'bg-gray-50'}`}>
                        {r === 1 ? <Frown className="w-6 h-6 text-red-400" /> : 
                         r === 2 ? <Frown className="w-6 h-6 text-orange-400" /> : 
                         r === 3 ? <Meh className="w-6 h-6 text-yellow-400" /> : 
                         r === 4 ? <Smile className="w-6 h-6 text-green-400" /> : 
                         <Star className="w-6 h-6 text-yellow-500 fill-current" />}
                    </button>
                ))}
            </div>
            {rating > 0 && (
                <div className="animate-fade-in relative z-10">
                    <input 
                        type="text" 
                        placeholder="Kurze Notiz (optional)..." 
                        className="w-full p-3 border border-gray-200 rounded-xl mb-3 text-sm focus:outline-none focus:border-indigo-400 transition-colors" 
                        value={note} 
                        onChange={e => setNote(e.target.value)} 
                    />
                    <button onClick={submitMood} className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 transition-colors">Absenden (+50 XP)</button>
                </div>
            )}
        </div>
    );
};

const DashboardView = ({ db, userId, stats, levelStats, activeQuests, inventory, onMoodLogged }) => {
    const dailyQuests = activeQuests.filter(q => q.type === 'daily');
    const completedDaily = dailyQuests.filter(t => t.isCompleted).length;
    const dailyProgress = dailyQuests.length > 0 ? (completedDaily / dailyQuests.length) * 100 : 0;
    
    // Safe access to userStats properties
    const safeStats = stats || { level: 1, gold: 0, nutritionStreak: 0, lootBoxes: 0, xp: 0 };
    const safeLevelStats = levelStats || { xpToNextLevel: 100, progressPercentage: 0 };
    const safeInventory = inventory || [];

    return (
        <div className="p-6 space-y-8 max-w-7xl mx-auto">
            <MoodWidget db={db} userId={userId} onMoodLogged={onMoodLogged} />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { title: "Level", value: safeStats.level, icon: TrendingUp, color: 'indigo', sub: `${safeLevelStats.xpToNextLevel} XP bis Up` },
                    { title: "Lootboxen", value: safeStats.lootBoxes, icon: Box, color: 'yellow', sub: 'Zum Öffnen' },
                    { title: "Streak", value: `${safeStats.nutritionStreak} Tage`, icon: Flame, color: 'orange', sub: 'Ernährung' },
                    { title: "Inventar", value: `${safeInventory.length} Items`, icon: Backpack, color: 'blue', sub: 'Gesammelt' }
                ].map((card, i) => <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"><div className={`p-3 rounded-xl bg-${card.color}-50 text-${card.color}-600 mb-4 inline-block`}><card.icon className="w-6 h-6" /></div><p className="text-3xl font-bold text-gray-800 mb-1">{card.value}</p><p className="text-sm text-gray-500 font-medium">{card.sub}</p></div>)}
            </div>
            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-6"><h3 className="text-lg font-bold text-gray-800">Heutige Quests</h3><span className="text-sm font-medium text-gray-500">{dailyProgress.toFixed(0)}%</span></div>
                    <div className="w-full bg-gray-100 rounded-full h-3 mb-6"><div className="bg-green-500 h-3 rounded-full transition-all duration-1000" style={{ width: `${dailyProgress}%` }}></div></div>
                    <div className="space-y-3">{dailyQuests.slice(0, 3).map(q => <div key={q.id} className={`flex items-center justify-between p-3 rounded-lg border ${q.isCompleted ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}><div className="flex items-center">{q.isCompleted ? <CheckCircle className="w-4 h-4 text-green-500 mr-2" /> : <div className="w-4 h-4 border-2 border-gray-300 rounded-full mr-2"></div>}<span className={`text-sm ${q.isCompleted ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{q.title}</span></div><span className="text-xs text-gray-400">+{q.xpReward} XP</span></div>)}</div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center"><Sparkles className="w-5 h-5 mr-2 text-yellow-500" /> Neueste Legendäre Items</h3>
                    {safeInventory.filter(i => i.rarity === 'legendary' || i.rarity === 'divine').length > 0 ? <div className="grid grid-cols-4 gap-2">{safeInventory.filter(i => i.rarity === 'legendary' || i.rarity === 'divine').slice(-4).reverse().map((item, idx) => <div key={idx} className={`aspect-square flex items-center justify-center text-2xl bg-gray-50 rounded-xl border-2 ${item.rarity === 'legendary' ? 'border-yellow-400 bg-yellow-50 shadow-yellow-100' : 'border-sky-300 bg-sky-50'}`} title={item.name}>{item.icon}</div>)}</div> : <p className="text-gray-400 text-sm italic">Noch keine legendären Funde.</p>}
                </div>
            </div>
        </div>
    );
};

// --- APP CONTAINER ---
// Diese Komponente enthält die gesamte Logik der App, die zuvor in "App" war.
// Sie wird unten von der neuen "App"-Wrapper-Komponente verwendet.
function LifeGamifierContent() {
    const [authReady, setAuthReady] = useState(false);
    const [currentUserId, setCurrentUserId] = useState(null);
    const [dbInstance, setDbInstance] = useState(null);
    const [userStats, setUserStats] = useState({ xp: 0, level: 1, gold: 0, lootBoxes: 0, totalCaloriesTracked: 0, lastNutritionDate: null, todayCalories: 0, nutritionStreak: 0, perfectDayStreak: 0, totalDailyQuestsCompleted: 0, achievements: {}, displayName: '', title: '', bio: '', avatar: '👤', unlockedAvatars: ['👤'] });
    const [recurringCompletionMap, setRecurringCompletionMap] = useState({});
    const [questSelections, setQuestSelections] = useState({ daily: { date: null, ids: [] }, weekly: { weekStart: null, ids: [] }, monthly: { monthStart: null, ids: [] } });
    const [inventory, setInventory] = useState([]);
    const [currentView, setCurrentView] = useState('dashboard');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notification, setNotification] = useState({ message: '', type: '', visible: false });
    const [allBosses, setAllBosses] = useState([]);

    const levelStats = useMemo(() => calculateLevelProgress(userStats.xp || 0), [userStats.xp]);
    const showNotification = useCallback((m, t = 'success') => { setNotification({ message: m, type: t, visible: true }); setTimeout(() => setNotification(n => ({ ...n, visible: false })), 3000); }, []);

    useEffect(() => {
        if (!firebaseConfig.apiKey) { setLoading(false); return; }
        // Wir nutzen die globale `app`, `auth`, `db` Instanzen, die oben definiert sind
        setDbInstance(db);
        const initAuth = async () => { 
            try { 
                await signInAnonymously(auth); 
            } catch(e) { 
                console.error("Auth Error:", e);
                setError(e.message);
                setLoading(false);
            } 
        };
        onAuthStateChanged(auth, u => { if (u) { setCurrentUserId(u.uid); setAuthReady(true); } else initAuth(); });
    }, []);

    useEffect(() => {
        if (!authReady || !dbInstance || !currentUserId) return;
        const uid = currentUserId;
        
        const handleError = (e) => {
            console.error("Firestore Error:", e);
            if (e.code === 'permission-denied') return;
            // setError("Datenbankverbindung fehlgeschlagen. Bitte prüfe deine Internetverbindung.");
            // Kein Blocking Error setzen, da manche Listener vllt. funktionieren
            setLoading(false);
        };

        const unsubStats = onSnapshot(getUserStatsDocRef(db, uid), snap => {
            if (snap.exists()) {
                const data = snap.data();
                const today = new Date().toISOString().slice(0, 10);
                if (data.lastNutritionDate !== today) data.todayCalories = 0;
                setUserStats({ ...data, ...calculateLevelProgress(data.xp || 0) });
            } else setDoc(getUserStatsDocRef(db, uid), { xp: 0, level: 1, gold: 0, lootBoxes: 0, nutritionStreak: 0, unlockedAvatars: ['👤'] }).catch(console.error);
            setLoading(false);
        }, handleError);

        const unsubTasks = onSnapshot(getTasksCollectionRef(db, uid), snap => {
            const compMap = {};
            snap.docs.forEach(d => { const val = d.data(); if (val.type === 'recurring_tracking') compMap[val.predefinedId] = { id: d.id, lastCompleted: val.lastCompleted?.toDate().toISOString() }; });
            setRecurringCompletionMap(compMap);
        }, handleError);

        const unsubSel = onSnapshot(getSelectionsDocRef(db, uid), snap => { if (snap.exists()) setQuestSelections(snap.data()); else setQuestSelections({ daily: { date: null, ids: [] }, weekly: { weekStart: null, ids: [] }, monthly: { monthStart: null, ids: [] } }); }, handleError);
        const unsubInv = onSnapshot(getInventoryCollectionRef(db, uid), snap => setInventory(snap.docs.map(d => d.data())), handleError);
        const unsubBosses = onSnapshot(getBossesCollectionRef(db, uid), s => setAllBosses(s.docs.map(d => ({id: d.id, ...d.data()}))), handleError);
        return () => { unsubStats(); unsubTasks(); unsubSel(); unsubInv(); unsubBosses(); };
    }, [authReady, dbInstance, currentUserId]);

    useEffect(() => {
        if (!authReady || !dbInstance || !currentUserId || loading) return;
        const manageSelections = async () => {
            const today = new Date().toISOString().slice(0, 10);
            const currentWeekStart = getStartOfWeek(new Date()).toISOString().slice(0, 10);
            const currentMonthStart = getStartOfMonth(new Date()).toISOString().slice(0, 10);
            let needsUpdate = false; let newSelections = { ...questSelections };
            const pickQuests = (pool, count, cooldownDays = 0) => {
                const candidates = pool.filter(q => {
                    const lastComp = recurringCompletionMap[q.id]?.lastCompleted;
                    if (!lastComp) return true;
                    const diffTime = Math.abs(new Date() - new Date(lastComp));
                    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) > cooldownDays;
                });
                return shuffleArray(candidates).slice(0, count).map(q => q.id);
            };
            if (newSelections.daily.date !== today) { newSelections.daily = { date: today, ids: pickQuests(PREDEFINED_DAILY_QUESTS, QUEST_TYPES.daily.maxShow, 3) }; needsUpdate = true; }
            if (newSelections.weekly.weekStart !== currentWeekStart) { newSelections.weekly = { weekStart: currentWeekStart, ids: pickQuests(PREDEFINED_WEEKLY_QUESTS, QUEST_TYPES.weekly.maxShow, 0) }; needsUpdate = true; }
            if (newSelections.monthly.monthStart !== currentMonthStart) { newSelections.monthly = { monthStart: currentMonthStart, ids: pickQuests(PREDEFINED_MONTHLY_QUESTS, QUEST_TYPES.monthly.maxShow, 0) }; needsUpdate = true; }
            if (needsUpdate) await setDoc(getSelectionsDocRef(dbInstance, currentUserId), newSelections, { merge: true });
        };
        manageSelections();
    }, [questSelections, recurringCompletionMap, authReady, dbInstance, currentUserId, loading]);

    const activeQuests = useMemo(() => {
        const resolve = (ids, list, type) => {
            // Sicherheitscheck: Falls ids undefined ist, leeres Array zurückgeben
            if (!ids) return [];
            return ids.map(id => {
                const def = list.find(q => q.id === id); if (!def) return null;
                const status = recurringCompletionMap[id];
                const last = status?.lastCompleted;
                let isComp = false;
                // Sicherheitscheck für questSelections
                if (type === 'daily' && questSelections.daily?.date) isComp = last && last.startsWith(questSelections.daily.date);
                else if (type === 'weekly') isComp = isCompletedThisWeek(last);
                else if (type === 'monthly') isComp = isCompletedThisMonth(last);
                return { ...def, type, isCompleted: isComp, completionDocId: status?.id, xpReward: getRewards(type, def.difficulty).xp };
            }).filter(Boolean);
        };
        return [
            ...resolve(questSelections.daily?.ids || [], PREDEFINED_DAILY_QUESTS, 'daily'), 
            ...resolve(questSelections.weekly?.ids || [], PREDEFINED_WEEKLY_QUESTS, 'weekly'), 
            ...resolve(questSelections.monthly?.ids || [], PREDEFINED_MONTHLY_QUESTS, 'monthly')
        ];
    }, [questSelections, recurringCompletionMap]);

    const completeTask = useCallback(async (taskId, task) => {
        if (!dbInstance || !currentUserId || task.isCompleted) return;
        const rewards = getRewards(task.type, task.difficulty);
        const hasLootBox = Math.random() < rewards.lootBoxChance;
        const activeBoss = allBosses.find(b => b.active && b.currentHp > 0);
        try {
            await runTransaction(dbInstance, async (t) => {
                const ref = task.completionDocId ? doc(getTasksCollectionRef(dbInstance, currentUserId), task.completionDocId) : doc(getTasksCollectionRef(dbInstance, currentUserId));
                const taskData = { lastCompleted: Timestamp.now(), type: 'recurring_tracking', predefinedId: task.id };
                task.completionDocId ? t.update(ref, taskData) : t.set(ref, taskData);
                t.update(getUserStatsDocRef(dbInstance, currentUserId), { xp: increment(rewards.xp), gold: increment(rewards.gold), lootBoxes: increment(hasLootBox ? 1 : 0), totalDailyQuestsCompleted: increment(1) });
                if (activeBoss) {
                    const bossRef = doc(getBossesCollectionRef(dbInstance, currentUserId), activeBoss.id);
                    const newHp = activeBoss.currentHp - rewards.dmg;
                    t.update(bossRef, { currentHp: Math.max(0, newHp) });
                    if (newHp <= 0) t.update(getUserStatsDocRef(dbInstance, currentUserId), { xp: increment(1000), gold: increment(500), lootBoxes: increment(2) });
                }
            });
            let msg = `+${rewards.xp} XP`;
            if (activeBoss) msg += `, -${rewards.dmg} HP Boss!`;
            if (hasLootBox) msg += `, +1 🎁 Lootbox!`;
            showNotification(msg);
        } catch(e) { console.error(e); showNotification('Fehler', 'error'); }
    }, [dbInstance, currentUserId, allBosses, showNotification]);

    const logNutrition = useCallback(async (cal, desc) => {
        if (!dbInstance || !currentUserId) return;
        const today = new Date().toISOString().slice(0, 10);
        try {
            await runTransaction(dbInstance, async (t) => {
                const statsRef = getUserStatsDocRef(dbInstance, currentUserId);
                const snap = await t.get(statsRef);
                const curr = snap.data();
                let xp = 0, gold = 0;
                let updates = { totalCaloriesTracked: increment(cal), lastNutritionDate: today, todayCalories: (curr.lastNutritionDate === today ? curr.todayCalories : 0) + cal };
                if (curr.lastNutritionDate !== today) { xp = 20; gold = 5; updates.xp = increment(xp); updates.gold = increment(gold); updates.nutritionStreak = (curr.lastNutritionDate === new Date(new Date().setDate(new Date().getDate()-1)).toISOString().slice(0,10)) ? (curr.nutritionStreak || 0) + 1 : 1; }
                t.update(statsRef, updates);
            });
            showNotification(`+${cal} kcal`);
        } catch (e) { showNotification('Fehler', 'error'); }
    }, [dbInstance, currentUserId, showNotification]);

    const onMoodLogged = async () => { try { await updateDoc(getUserStatsDocRef(dbInstance, currentUserId), { xp: increment(50) }); showNotification('Stimmung geloggt! +50 XP'); } catch (e) {} };

    const claimAchievement = useCallback(async (achievement) => {
        if (!dbInstance || !currentUserId) return;
        try {
            await runTransaction(dbInstance, async (t) => {
                const statsRef = getUserStatsDocRef(dbInstance, currentUserId);
                const snap = await t.get(statsRef);
                const stats = snap.data();
                let current = 0;
                if (achievement.type === 'nutritionStreak') current = stats.nutritionStreak || 0;
                if (achievement.type === 'perfectDayStreak') current = stats.perfectDayStreak || 0;
                if (achievement.type === 'totalDailies') current = stats.totalDailyQuestsCompleted || 0;
                if (current < achievement.target) throw new Error("Nicht erfüllt");
                if (stats.achievements && stats.achievements[achievement.id]) throw new Error("Bereits abgeholt");
                const update = { xp: increment(achievement.xpReward), lootBoxes: increment(achievement.lootBoxReward), [`achievements.${achievement.id}`]: Timestamp.now() };
                t.update(statsRef, update);
            });
            showNotification(`Meilenstein erreicht! +${achievement.lootBoxReward} Boxen`);
        } catch (e) { showNotification(e.message, 'error'); }
    }, [dbInstance, currentUserId, showNotification]);

    if (error) return <ErrorDisplay message={error} />;
    if (loading || !authReady) return <LoadingSpinner />;
    const commonProps = { db: dbInstance, userId: currentUserId, showNotification, stats: userStats };
    let Content;
    if (currentView === 'tasks') Content = <TasksView {...commonProps} activeQuests={activeQuests} completeTask={completeTask} claimAchievement={claimAchievement} />;
    else if (currentView === 'nutrition') Content = <NutritionView {...commonProps} logNutrition={logNutrition} />;
    else if (currentView === 'inventory') Content = <InventoryView {...commonProps} inventory={inventory} />;
    else if (currentView === 'adventure') Content = <AdventureView {...commonProps} />;
    else if (currentView === 'profile') Content = <ProfileView {...commonProps} />;
    else Content = <DashboardView stats={userStats} levelStats={levelStats} activeQuests={activeQuests} inventory={inventory} onMoodLogged={onMoodLogged} />;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans text-gray-800">
            <Sidebar currentView={currentView} setCurrentView={setCurrentView} userId={currentUserId} />
            <div className="flex-1 flex flex-col overflow-hidden relative">
                <ErrorBoundary>
                    <Header stats={userStats} levelStats={levelStats} inventory={inventory} />
                    <main className="flex-1 overflow-y-auto bg-gray-50 scroll-smooth">{Content}</main>
                </ErrorBoundary>
            </div>
            <NotificationToast notification={notification} />
        </div>
    );
}

// --- HAUPT APP WRAPPER (mit ErrorBoundary) ---
// Diese Komponente ist der Einstiegspunkt, der sicherstellt, dass Fehler abgefangen werden
function App() {
    return (
        <ErrorBoundary>
            <LifeGamifierContent />
        </ErrorBoundary>
    );
}

export default App;
