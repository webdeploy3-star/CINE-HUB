import React, { useState, useEffect } from 'react';
import { 
  Smartphone, CheckCircle2, AlertCircle, Loader2, QrCode, Hash, 
  Wifi, WifiOff, Sun, Moon, Trash2, Users, Settings, Link2, Clock, MessageSquare, HelpCircle
} from 'lucide-react';

const API_BASE = window.location.origin + '/api';

const SUCCESS_TEMPLATES = [
  { id: 1, text: "{name}\n📍 {city}\n🎂 {age}\n🌸 {gender}" },
  { id: 2, text: "{name} 🤍\n📍 {city}\n🎂 {age}\n🌼 {gender}" },
  { id: 3, text: "{name} 🦋\n🏡 {city}\n🎂 {age}\n✨ {gender}" },
  { id: 4, text: "{name}\n🌸 {gender}\n🎂 {age}\n📍 {city}" },
  { id: 5, text: "{name} 🍓\n📍 {city}\n🌷 {gender}\n🎂 {age}" },
  { id: 6, text: "{name}\n🎂 {age}\n📍 {city}\n🤍 {gender}" },
  { id: 7, text: "{name} 🌿\n📍 {city}\n🎂 {age}\n🦋 {gender}" },
  { id: 8, text: "{name}\n📍 {city}\n💞 {gender}\n🎂 {age}" },
  { id: 9, text: "{name} ☁️\n🏡 {city}\n🌸 {gender}\n🎂 {age}" },
  { id: 10, text: "{name}\n📍 {city}\n🎂 {age}\n💫 {gender}" },
  { id: 11, text: "{name} 💖\n📍 {city}\n🎂 {age}\n🌺 {gender}" },
  { id: 12, text: "{name}\n🌼 {gender}\n📍 {city}\n🎂 {age}" },
  { id: 13, text: "{name} 🧸\n📍 {city}\n🎂 {age}\n🤍 {gender}" },
  { id: 14, text: "{name}\n📍 {city}\n🎂 {age}\n🍀 {gender}" },
  { id: 15, text: "{name} 🌙\n🏡 {city}\n🎂 {age}\n🌷 {gender}" },
  { id: 16, text: "{name}\n📍 {city}\n✨ {gender}\n🎂 {age}" },
  { id: 17, text: "{name} 🕊️\n📍 {city}\n🎂 {age}\n🤎 {gender}" },
  { id: 18, text: "{name}\n🏡 {city}\n🎂 {age}\n💜 {gender}" },
  { id: 19, text: "{name} 🌈\n📍 {city}\n🎂 {age}\n⭐ {gender}" },
  { id: 20, text: "{name}\n📍 {city}\n🎂 {age}\n🌻 {gender}" },
  { id: 21, text: "{name} 🌹\n📍 {city}\n🎂 {age}\n🩵 {gender}" },
  { id: 22, text: "{name}\n📍 {city}\n🎂 {age}\n🩷 {gender}" },
  { id: 23, text: "{name} 🍒\n📍 {city}\n🎂 {age}\n🦄 {gender}" },
  { id: 24, text: "{name}\n📍 {city}\n🎂 {age}\n🌟 {gender}" },
  { id: 25, text: "{name} 💎\n📍 {city}\n🎂 {age}\n💝 {gender}" },
  { id: 26, text: "{name}\n📍 {city}\n🎂 {age}\n🌸 {gender} • 🤍" },
  { id: 27, text: "{name} 🤍\n📍 {city}\n🎂 {age}\n🦋 {gender}" },
  { id: 28, text: "{name}\n🏡 {city}\n🎂 {age}\n💫 {gender}" },
  { id: 29, text: "{name} ✨\n📍 {city}\n🎂 {age}\n🌷 {gender}" },
  { id: 30, text: "{name}\n📍 {city}\n🎂 {age}\n🤍 Status Vibes" },
  { id: 31, text: "{name}\n🏠 {city}\n🎂 {age}\n👥 {gender}" }
];

const SUCCESS_MSG_TEMPLATES = [
  {
    id: 1,
    title: "💖 Romantic Vibe (Owner's Fav)",
    text: "💖🥺 **මම නම් ඔයාව දැනටමත් Save කරලා ඉවරයි සුදූ...** 🤍🌸\n\n📲 **දැන් ඔයත් මාව Save කරගෙන පුංචි Message එකක් දාන්න හරිද?** 😚💌✨ \n\n━━━━━━━━━━━━━━━━━━\n\n🤍⃞⃔🦋 | 𝐅𝐨𝐫 𝐒𝐭𝐚𝐭𝐮𝐬 𝐕𝐢𝐛𝐞𝐬 | 🐼⃪⃮⃖🌸\n\n😒💫 ~ {ownerGender} Only 🤗❤️🩹\n🫐⃝⃞⃟🫐 ~ හායි ලස්සන ළමයෝ ~ 🌼⃟⃞⃝\n\n🫂💞 ʜʏ_ᴄᴜᴅᴜ 🤍🥺\n💌 https://wa.me/{botNumber}?text=Hy%20මැණිකහ්%20🍒💋\n\n━━━━━━━━━━━━━━━━━━\n\n🐼⃪⃮⃖☘️ නම : ᥫ᭡ {ownerName} 🤍🍓\n\n🐼⃪⃮⃖☘️ ගම : ᥫ᭡ {ownerCity} 🤍🍓\n\n🐼⃪⃮⃖☘️ වයස : ᥫ᭡ {ownerAge} 🤍🍓\n\n━━━━━━━━━━━━━━━━━━\n\n💐🤍\nඔයාගෙත් **නම, ගම, වයස** කියලා\nමටත් Message එකක් දාන්න හරිද සුදුවෝ? 😩💗✨\n\n╭━━━━━━━♡━━━━━━━╮\n❍  Love & Respect ❍\n╰━━━━━━━━━━━━━━━━╯"
  },
  {
    id: 2,
    title: "🌸 Sweet Heart Style",
    text: "🌸✨ **ඔයාගේ විස්තර මම සතුටින් සේව් කරගත්තා මැණික...** 🥺💞\n\n📲 **ඔයත් දැන්ම මගේ නම්බර් එක සේව් කරගෙන \"Saved\" කියලා මැසේජ් එකක් දාන්නකෝ...** 🙈💌\n\n━━━━━━━━━━━━━━━━━━\n🧸🍒 *ᴍʏ ᴘʀᴏғɪʟᴇ ᴅᴇᴛᴀɪʟs* 🍒🧸\n━━━━━━━━━━━━━━━━━━\n👤 *නම :* {ownerName}\n📍 *ගම :* {ownerCity}\n🔢 *වයස :* {ownerAge}\n👥 *Gender :* {ownerGender}\n\n💬 *Contact Link:* https://wa.me/{botNumber}\n━━━━━━━━━━━━━━━━━━\n✨ *Thanks for connecting with us!* ✨"
  },
  {
    id: 3,
    title: "🤍🕊️ Premium Minimalist",
    text: "🤍🕊️ **Done, Sweety! I have saved your number.** \n\n👉 **Now please save my number too and stay tuned for my status updates!** 💫\n\n🏡 *Owner:* {ownerName} ({ownerCity})\n🎂 *Age:* {ownerAge} | {ownerGender}\n📲 *Chat:* https://wa.me/{botNumber}\n\n🌿 *Have a wonderful day ahead!* 🌿"
  },
  {
    id: 4,
    title: "🦋 Status Vibes Booster",
    text: "🦋✨ **ඔයාගේ Number එක සේව් කරගත්තා සුදූ...** 🌈🧸\n\n📲 **දැන් ඔයත් මාව Save කරගෙන මැසේජ් එකක් දාන්න. එතකොට තමා Status පේන්නේ...** 😚💞\n\n🐼⃪⃮⃖🌸 *My details:*\n👤 *නම:* {ownerName}\n🏡 *ගම:* {ownerCity}\n🎂 *වයස:* {ownerAge}\n👥 *Gender:* {ownerGender}\n\n💌 *WhatsApp Link:* https://wa.me/{botNumber}?text=Saved%20Cudu\n\n💡 *Note:* Please save our number as **{ownerName}**!"
  },
  {
    id: 5,
    title: "🧸 Default Chama Shield Style",
    text: "🧸💫 **ඔබගේ තොරතුරු සාර්ථකව සුරැකුණා!** 🤍🌸\n\n📲 **කරුණාකර අපගේ දුරකථන අංකයද සුරැකීමට කාරුණික වන්න.** 😚💌\n\n━━━━━━━━━━━━━━━━━━\n🤖 *ʙᴏᴛ ᴏᴡɴᴇʀ ᴘʀᴏғɪʟᴇ:*\n👤 *නම:* {ownerName}\n📍 *ගම:* {ownerCity}\n🔢 *වයස:* {ownerAge}\n🧑‍🤝‍🧑 *භාවය:* {ownerGender}\n\n🔗 *WhatsApp Link:* https://wa.me/{botNumber}\n━━━━━━━━━━━━━━━━━━\n🛡️ Powered by 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘"
  }
];

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [activeTab, setActiveTab] = useState('pair'); // 'pair', 'deletes', 'contacts', 'settings'
  
  // Connection / pairing states
  const [botNumber, setBotNumber] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [linkMethod, setLinkMethod] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [qrCodeData, setQrCodeData] = useState('');
  const [pairCodeData, setPairCodeData] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [pollInterval, setPollInterval] = useState(null);
  
  const [googleAuthenticated, setGoogleAuthenticated] = useState(false);
  const [checkingGoogleAuth, setCheckingGoogleAuth] = useState(false);

  // Password / Session isolation states
  const [sessionPassword, setSessionPassword] = useState('');
  const [authNumber, setAuthNumber] = useState(localStorage.getItem('statusofc_num') || '');
  const [authPassword, setAuthPassword] = useState(localStorage.getItem('statusofc_pw') || '');
  const [isUnlocked, setIsUnlocked] = useState(!!(localStorage.getItem('statusofc_num') && localStorage.getItem('statusofc_pw')));
  const [unlockError, setUnlockError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);

  // MongoDB logging and config states
  const [deletedMessages, setDeletedMessages] = useState([]);
  const [savedContacts, setSavedContacts] = useState([]);
  const [botSettings, setBotSettings] = useState({
    minViewDelay: 15,
    maxViewDelay: 90,
    minReactDelay: 5,
    maxReactDelay: 20,
    reactProbability: 85,
    emojis: '🧩, 🍉, 💜, 🌸, 🪴, 💫, 🍂, 🌟, 🫀, 🧿, 👀, 🥰, 💙, 💚, 💛',
    autoSave: true,
    welcomeQuestionnaire: '',
    askCityMsg: '',
    askAgeMsg: '',
    askGenderMsg: '',
    welcomeConnectMsg: '',
    enableDeletedAlert: true,
    questionnaireSuccessMsg: '',
    askProcessingMsg: '',
    alwaysOffline: false,
    contactNameFormat: '{name} 🤍 ({city}) - {age} - {gender}',
    ownerName: '',
    ownerCity: '',
    ownerAge: '',
    ownerGender: '',
    spamProtection: true,
    maxDailyReactions: 250
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [dashboardStats, setDashboardStats] = useState({
    totalContacts: 0,
    totalDeleted: 0,
    uptime: 'Offline',
    activeSessionsCount: 0
  });

  useEffect(() => {
    // Theme initialization
    const localTheme = localStorage.getItem('theme');
    if (localTheme === 'dark') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pollInterval]);

  useEffect(() => {
    if (isUnlocked) {
      fetchDeletedMessages();
      fetchSavedContacts();
      fetchSettings();
      fetchDashboardStats();
      const interval = setInterval(fetchDashboardStats, 10000);
      return () => clearInterval(interval);
    }
  }, [isUnlocked]);

  const toggleTheme = () => {
    if (darkMode) {
      setDarkMode(false);
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  };

  // --- API CALLS ---

  const unlockDashboard = async (e) => {
    e.preventDefault();
    if (!authNumber || !authPassword) {
      setUnlockError('Please enter both WhatsApp number and password.');
      return;
    }
    setIsUnlocking(true);
    setUnlockError('');
    try {
      const res = await fetch(`${API_BASE}/verify-session-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: authNumber, password: authPassword })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('statusofc_num', authNumber);
        localStorage.setItem('statusofc_pw', authPassword);
        setIsUnlocked(true);
        setUnlockError('');
        setStatus({ type: 'success', message: 'Dashboard unlocked successfully!' });
        setActiveTab('settings');
      } else {
        setUnlockError(data.error || 'Authentication failed.');
      }
    } catch (err) {
      setUnlockError('Network connection error.');
    } finally {
      setIsUnlocking(false);
    }
  };

  const lockDashboard = () => {
    localStorage.removeItem('statusofc_num');
    localStorage.removeItem('statusofc_pw');
    setAuthNumber('');
    setAuthPassword('');
    setIsUnlocked(false);
    setActiveTab('pair');
    setStatus({ type: 'info', message: 'Dashboard locked.' });
  };

  const fetchDeletedMessages = async () => {
    try {
      const res = await fetch(`${API_BASE}/deleted-messages?number=${authNumber}&password=${authPassword}`);
      const data = await res.json();
      if (data.success) {
        setDeletedMessages(data.logs || []);
      } else if (res.status === 401) {
        setIsUnlocked(false);
      }
    } catch (e) {}
  };

  const fetchSavedContacts = async () => {
    try {
      const res = await fetch(`${API_BASE}/saved-contacts?number=${authNumber}&password=${authPassword}`);
      const data = await res.json();
      if (data.success) {
        setSavedContacts(data.logs || []);
      } else if (res.status === 401) {
        setIsUnlocked(false);
      }
    } catch (e) {}
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/get-settings?number=${authNumber}&password=${authPassword}`);
      const data = await res.json();
      if (data.success && data.settings) {
        setBotSettings(data.settings);
        if (authNumber) {
          checkGoogleAuth(authNumber);
        }
      } else if (res.status === 401) {
        setIsUnlocked(false);
      }
    } catch (e) {}
  };

  const fetchDashboardStats = async () => {
    if (!authNumber || !authPassword) return;
    try {
      const res = await fetch(`${API_BASE}/dashboard-stats?number=${authNumber}&password=${authPassword}`);
      const data = await res.json();
      if (data.success && data.stats) {
        setDashboardStats(data.stats);
      }
    } catch (e) {}
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await fetch(`${API_BASE}/save-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          number: authNumber, 
          password: authPassword, 
          settings: botSettings 
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatus({ type: 'success', message: 'Settings saved and applied successfully.' });
      } else {
        setStatus({ type: 'error', message: data.error || 'Failed to save settings.' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Connection error while saving settings.' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const checkGoogleAuth = async (num) => {
    if (!num) return;
    setCheckingGoogleAuth(true);
    try {
      const res = await fetch(`${API_BASE}/check-google-auth?number=${num}&password=${authPassword}`);
      const data = await res.json();
      if (data.success) {
        setGoogleAuthenticated(data.authenticated);
      }
    } catch (e) {}
    setCheckingGoogleAuth(false);
  };

  const connectGoogle = async () => {
    try {
      const res = await fetch(`${API_BASE}/google-login-url?number=${authNumber}&password=${authPassword}`);
      const data = await res.json();
      if (data.success && data.url) {
        window.open(data.url, '_blank');
      }
    } catch (e) {
      setStatus({ type: 'error', message: 'Failed to retrieve Google Login URL.' });
    }
  };

  const disconnectGoogle = async () => {
    try {
      const res = await fetch(`${API_BASE}/disconnect-google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: authNumber, password: authPassword })
      });
      const data = await res.json();
      if (data.success) {
        setGoogleAuthenticated(false);
        setStatus({ type: 'success', message: 'Google account disconnected successfully.' });
      }
    } catch (e) {
      setStatus({ type: 'error', message: 'Failed to disconnect Google Account.' });
    }
  };

  const startSession = async (method) => {
    if (!isOnline) {
      setStatus({ type: 'error', message: 'You must be online to pair a new device.' });
      return;
    }
    if (method === 'code' && !botNumber) {
      setStatus({ type: 'error', message: 'Please enter WhatsApp number first!' });
      return;
    }

    setIsLoading(true);
    setStatus({ type: 'info', message: 'Initializing WhatsApp connection...' });
    setQrCodeData('');
    setPairCodeData('');
    
    try {
      const res = await fetch(`${API_BASE}/start-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, number: method === 'code' ? botNumber : '' })
      });
      const data = await res.json();
      if (data.success) {
        setSessionId(data.sessionId);
        setStatus({ type: '', message: '' });
        startPolling(data.sessionId);
      } else {
        setStatus({ type: 'error', message: data.error || 'Failed to start session.' });
      }
    } catch (e) {
      setStatus({ type: 'error', message: 'Network connection error.' });
    } finally {
      setIsLoading(false);
    }
  };

  const startPolling = (sid) => {
    if (pollInterval) clearInterval(pollInterval);
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/session-status?sessionId=${sid}`);
        const data = await res.json();
        if (data.success) {
          const s = data.data;
          if (s.status === 'qr') {
            setQrCodeData(s.qr);
          } else if (s.status === 'code') {
            setPairCodeData(s.pairCode);
          } else if (s.status === 'connected') {
            clearInterval(interval);
            setStatus({ type: 'success', message: `Connected successfully as +${s.number}!` });
            fetchSavedContacts();
          } else if (s.status === 'error') {
            clearInterval(interval);
            setStatus({ type: 'error', message: s.error || 'Error linking session.' });
          }
        }
      } catch (e) { }
    }, 2500);
    setPollInterval(interval);
  };

  const submit2FAPin = async () => {
    if (!otpCode) return;
    setStatus({ type: 'info', message: 'Saving 2FA PIN...' });
    try {
      const res = await fetch(`${API_BASE}/save-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: authNumber,
          password: authPassword,
          settings: { whatsappTwoFactorPin: otpCode }
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatus({ type: 'success', message: '2FA PIN saved. Bot will use this to connect.' });
        setOtpCode('');
      } else {
        setStatus({ type: 'error', message: data.error || 'Failed to save 2FA PIN.' });
      }
    } catch (e) {
      setStatus({ type: 'error', message: 'Error submitting PIN.' });
    }
  };

  return (
    <div className="min-h-screen transition-colors duration-300 p-4 relative overflow-hidden bg-[#e0e8f6] dark:bg-[#181c2c]">
      {/* Background blobs */}
      <div className="glowing-blob blob-blue"></div>
      <div className="glowing-blob blob-cyan"></div>

      <div className="relative z-10 animate-slide-in">
        {/* Top Header */}
        <header className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between nm-outset rounded-2xl mb-8 gap-4 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-3">
            <QrCode className="h-8 w-8 text-[#5a73a3] dark:text-[#8ea9db] animate-soft-float" />
            <div>
              <h1 className="text-xl font-black tracking-wider text-slate-800 dark:text-slate-100">
                𝐌𝐀𝐃𝐔𝐒𝐀𝐍𝐊𝐀-𝐌𝐃 𝐕2
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Lightweight Bot Control Center</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold nm-inset">
              {isOnline ? (
                <>
                  <Wifi className="h-4 w-4 text-emerald-500 animate-pulse" />
                  <span className="text-emerald-600 dark:text-emerald-400">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-rose-500 animate-bounce" />
                  <span className="text-rose-600 dark:text-rose-400">Offline</span>
                </>
              )}
            </div>
            <a 
              href="/help" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="px-3 py-2 rounded-xl nm-btn font-bold text-xs text-indigo-600 dark:text-indigo-400 hover:scale-105 transition-all flex items-center space-x-1"
            >
              <HelpCircle className="h-4 w-4" />
              <span>Help Guide</span>
            </a>

            {isUnlocked && (
              <button 
                onClick={lockDashboard} 
                className="px-3 py-2 rounded-xl nm-btn font-bold text-xs text-rose-600 dark:text-[#f87171] hover:scale-105 transition-all"
              >
                Lock Settings
              </button>
            )}

            <button onClick={toggleTheme} className="p-2.5 rounded-full nm-btn text-slate-600 dark:text-slate-300 hover:scale-105 active:scale-95 transition-all">
              {darkMode ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </header>

        {/* Status Alerts */}
        {status.message && (
          <div className="max-w-4xl mx-auto mb-6 animate-slide-in">
            <div className={`p-4 rounded-xl flex items-center space-x-3 nm-inset ${
              status.type === 'error' ? 'text-rose-600 dark:text-rose-400' : 
              status.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 
              'text-blue-600 dark:text-blue-400'
            }`}>
              {status.type === 'error' ? <AlertCircle className="h-5 w-5 flex-shrink-0" /> : 
               status.type === 'success' ? <CheckCircle2 className="h-5 w-5 flex-shrink-0" /> : 
               <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin" />}
              <span className="text-sm font-semibold">{status.message}</span>
              <button onClick={() => setStatus({type:'', message:''})} className="ml-auto text-xs opacity-60 hover:opacity-100 font-bold">Dismiss</button>
            </div>
          </div>
        )}

        {/* Stats Panel */}
        {isUnlocked && (
          <div className="max-w-4xl mx-auto mb-8 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 animate-slide-in">
            <div className="p-4 sm:p-5 rounded-2xl nm-outset flex flex-col items-center justify-center text-center space-y-1">
              <span className="text-2xl sm:text-3xl font-black text-[#5a73a3] dark:text-[#8ea9db]">{dashboardStats.totalContacts}</span>
              <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Saved Contacts</span>
            </div>
            
            <div className="p-4 sm:p-5 rounded-2xl nm-outset flex flex-col items-center justify-center text-center space-y-1">
              <span className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400">{dashboardStats.totalDeleted}</span>
              <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Intercepts</span>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl nm-outset flex flex-col items-center justify-center text-center space-y-1">
              <span className="text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">{dashboardStats.uptime}</span>
              <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Bot Uptime</span>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl nm-outset flex flex-col items-center justify-center text-center space-y-1">
              <span className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400">{dashboardStats.activeSessionsCount || 0}</span>
              <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Connected Bots</span>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="max-w-4xl mx-auto mb-8 flex space-x-2 sm:space-x-4 overflow-x-auto p-1.5 rounded-2xl nm-inset scrollbar-none">
          {(isUnlocked 
            ? [
                { id: 'pair', label: 'Link Bot', icon: Link2 },
                { id: 'deletes', label: 'Deleted Messages', icon: Trash2 },
                { id: 'contacts', label: 'Saved Contacts', icon: Users },
                { id: 'settings', label: 'Settings', icon: Settings }
              ]
            : [
                { id: 'pair', label: 'Link Bot', icon: Link2 },
                { id: 'login', label: 'Login', icon: Settings }
              ]
          ).map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'deletes') fetchDeletedMessages();
                  if (tab.id === 'contacts') fetchSavedContacts();
                  if (tab.id === 'settings') fetchSettings();
                }}
                className={`flex-1 sm:flex-initial flex-shrink-0 py-3 px-4 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all whitespace-nowrap ${
                  active ? 'nm-outset text-[#5a73a3] dark:text-[#8ea9db]' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        <main className="max-w-4xl mx-auto p-4 sm:p-6 rounded-2xl sm:rounded-3xl nm-outset space-y-6">
          
          {/* PAIR TAB */}
          {activeTab === 'pair' && (
            <div className="animate-slide-in space-y-6">
              <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">Connect to WhatsApp</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Inputs */}
                <div className="p-4 sm:p-6 rounded-2xl nm-inset space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      WhatsApp Number (Required for Pairing Code)
                    </label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={botNumber} 
                        onChange={(e) => setBotNumber(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="e.g. 94783314361" 
                        className="w-full pl-10 pr-4 py-3 rounded-xl nm-outset outline-none text-slate-800 dark:text-slate-200 focus:nm-inset transition-all"
                      />
                      <Smartphone className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold mb-3 text-slate-700 dark:text-slate-300">Select Connection Method</h3>
                    <div className="flex space-x-3">
                      <button 
                        onClick={() => { setLinkMethod('qr'); startSession('qr'); }}
                        className="flex-1 py-3 rounded-xl nm-btn font-bold flex items-center justify-center space-x-2 text-slate-700 dark:text-slate-300 hover:text-[#5a73a3] dark:hover:text-[#8ea9db]"
                      >
                        <QrCode className="h-5 w-5" />
                        <span>QR Code</span>
                      </button>
                      <button 
                        onClick={() => { setLinkMethod('code'); startSession('code'); }}
                        className="flex-1 py-3 rounded-xl nm-btn font-bold flex items-center justify-center space-x-2 text-slate-700 dark:text-slate-300 hover:text-[#5a73a3] dark:hover:text-[#8ea9db]"
                      >
                        <Hash className="h-5 w-5" />
                        <span>Pair Code</span>
                      </button>
                    </div>
                  </div>

                </div>

                {/* Display QR / Code */}
                <div className="p-4 sm:p-6 rounded-2xl nm-outset flex flex-col items-center justify-center min-h-[300px] relative overflow-hidden">
                  {isLoading || (linkMethod === 'qr' && !qrCodeData) || (linkMethod === 'code' && !pairCodeData) ? (
                    <div className="text-center space-y-3">
                      <Loader2 className="h-10 w-10 text-[#5a73a3] dark:text-[#8ea9db] mx-auto animate-spin" />
                      <p className="text-xs text-slate-400 animate-pulse">
                        {linkMethod === 'qr' ? 'Generating QR Code...' : 
                         linkMethod === 'code' ? 'Generating Pairing Code...' : 
                         'Requesting WhatsApp server...'}
                      </p>
                    </div>
                  ) : linkMethod === 'qr' && qrCodeData ? (
                    <div className="space-y-4 text-center animate-slide-in">
                      <div className="p-4 bg-white rounded-2xl inline-block shadow-inner animate-neon-pulse">
                        <img src={qrCodeData} alt="WhatsApp QR Code" className="h-44 w-44" />
                      </div>
                      <p className="text-[10px] text-slate-500 tracking-wider">Scan this QR code in WhatsApp &gt; Linked Devices</p>
                    </div>
                  ) : linkMethod === 'code' && pairCodeData ? (
                    <div className="text-center space-y-4 animate-slide-in">
                      <h4 className="text-xs uppercase text-slate-500 font-bold tracking-widest">Your Pairing Code</h4>
                      <div className="text-3xl font-black text-[#5a73a3] dark:text-[#8ea9db] tracking-widest px-6 py-4 rounded-2xl nm-inset font-mono animate-soft-float animate-neon-pulse">
                        {pairCodeData.slice(0, 4)}-{pairCodeData.slice(4)}
                      </div>
                      <p className="text-[10px] text-slate-500 max-w-[220px] mx-auto leading-relaxed">
                        Enter this code in WhatsApp Link Device notification on +{botNumber}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center space-y-2 text-slate-400 animate-soft-float">
                      <Smartphone className="h-12 w-12 mx-auto stroke-1 text-[#5a73a3] dark:text-[#8ea9db]" />
                      <p className="text-sm">Select connection method to begin pairing.</p>
                      <p className="text-[10px] text-slate-500 italic max-w-[180px] mx-auto leading-normal pt-2">
                        Auto-view status and auto-reactions will be active once linked.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* LOGIN TAB */}
          {activeTab === 'login' && !isUnlocked && (
            <div className="animate-slide-in max-w-md mx-auto p-6 rounded-2xl nm-inset space-y-6 text-center">
              <div className="flex justify-center">
                <Settings className="h-10 w-10 text-[#5a73a3] dark:text-[#8ea9db] animate-soft-float" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">Unlock Bot Dashboard</h2>
                <p className="text-xs text-slate-500 mt-1">Enter your WhatsApp bot number and session password to access configurations.</p>
              </div>

              {unlockError && (
                <p className="text-xs font-bold text-rose-600 dark:text-[#f87171]">{unlockError}</p>
              )}

              <form onSubmit={unlockDashboard} className="space-y-4 text-left">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2">WhatsApp Number (e.g. 94783314361)</label>
                  <input 
                    type="text"
                    value={authNumber}
                    onChange={(e) => setAuthNumber(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="94783314361"
                    className="w-full px-4 py-2.5 rounded-xl nm-outset outline-none text-slate-800 dark:text-slate-200 focus:nm-inset transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2">Session Password</label>
                  <input 
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 rounded-xl nm-outset outline-none text-slate-800 dark:text-slate-200 focus:nm-inset transition-all"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={isUnlocking}
                  className="w-full py-3 rounded-xl nm-btn font-black text-slate-800 dark:text-slate-200 flex items-center justify-center space-x-2 hover:scale-102 transition-all"
                >
                  {isUnlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  <span>Unlock Dashboard</span>
                </button>
              </form>
            </div>
          )}

          {/* ANTI-DELETE TAB */}
          {activeTab === 'deletes' && isUnlocked && (
            <div className="animate-slide-in space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">Intercepted Deleted Messages</h2>
                <button onClick={fetchDeletedMessages} className="text-xs font-bold text-[#5a73a3] dark:text-[#8ea9db] px-3 py-1.5 rounded-xl nm-btn">Refresh</button>
              </div>
              
              {deletedMessages.length === 0 ? (
                <div className="p-12 rounded-2xl nm-inset text-center text-slate-400 space-y-2">
                  <MessageSquare className="h-10 w-10 mx-auto stroke-1 text-slate-400" />
                  <p className="text-sm">No deleted messages intercepted yet.</p>
                  <p className="text-[10px] text-slate-500">Deleted messages from groups and direct chats will display here once recorded.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {deletedMessages.map((msg, index) => (
                    <div key={index} className="p-4 rounded-xl nm-inset space-y-2 animate-slide-in" style={{ animationDelay: `${index * 0.05}s` }}>
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200/5 pb-2">
                        <span className="font-bold text-[#5a73a3] dark:text-[#8ea9db]">@{msg.contactName || msg.contactNumber}</span>
                        <div className="flex items-center space-x-2">
                          <Clock className="h-3 w-3" />
                          <span>{new Date(msg.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                      <p className="text-sm text-slate-800 dark:text-slate-200 break-words font-mono italic">
                        "{msg.messageContent}"
                      </p>
                      <div className="text-[10px] font-bold text-slate-400">
                        Chat Type: <span className="opacity-80">{msg.chatType === 'group' ? 'Group Chat 👥' : 'Direct Chat 👤'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CONTACTS TAB */}
          {activeTab === 'contacts' && isUnlocked && (
            <div className="animate-slide-in space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">Auto-Saved Contacts</h2>
                <button onClick={fetchSavedContacts} className="text-xs font-bold text-[#5a73a3] dark:text-[#8ea9db] px-3 py-1.5 rounded-xl nm-btn">Refresh</button>
              </div>

              {savedContacts.length === 0 ? (
                <div className="p-12 rounded-2xl nm-inset text-center text-slate-400 space-y-2">
                  <Users className="h-10 w-10 mx-auto stroke-1 text-slate-400" />
                  <p className="text-sm">No contacts saved yet.</p>
                  <p className="text-[10px] text-slate-500">New contacts sending messages to the bot will automatically log here.</p>
                </div>
              ) : (
                <div className="rounded-2xl nm-inset overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200/10 text-slate-500 font-bold uppercase tracking-wider bg-slate-200/5">
                          <th className="p-4">Contact Name</th>
                          <th className="p-4">Phone Number</th>
                          <th className="p-4">Status</th>
                          <th className="p-4">Date Saved</th>
                        </tr>
                      </thead>
                      <tbody>
                        {savedContacts.map((contact, index) => (
                          <tr key={index} className="border-b border-slate-200/5 hover:bg-slate-200/5 transition-all">
                            <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{contact.contactName}</td>
                            <td className="p-4 font-mono">+{contact.contactNumber}</td>
                            <td className="p-4">
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-[10px]">
                                {contact.status}
                              </span>
                            </td>
                            <td className="p-4 text-slate-500">{new Date(contact.timestamp).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && isUnlocked && (
            <form onSubmit={saveSettings} className="animate-slide-in space-y-6">
              <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">Bot Configurations</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* View Delays */}
                <div className="p-6 rounded-2xl nm-inset space-y-4">
                  <h3 className="font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200/5 pb-2">Status Auto-View Delays</h3>
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2">Minimum View Delay (seconds)</label>
                    <input 
                      type="number"
                      value={botSettings.minViewDelay}
                      onChange={(e) => setBotSettings({...botSettings, minViewDelay: parseInt(e.target.value) || 0})}
                      className="w-full px-4 py-2.5 rounded-xl nm-outset outline-none text-slate-800 dark:text-slate-200 focus:nm-inset transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2">Maximum View Delay (seconds)</label>
                    <input 
                      type="number"
                      value={botSettings.maxViewDelay}
                      onChange={(e) => setBotSettings({...botSettings, maxViewDelay: parseInt(e.target.value) || 0})}
                      className="w-full px-4 py-2.5 rounded-xl nm-outset outline-none text-slate-800 dark:text-slate-200 focus:nm-inset transition-all"
                    />
                  </div>
                </div>

                {/* React Delays */}
                <div className="p-6 rounded-2xl nm-inset space-y-4">
                  <h3 className="font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200/5 pb-2">Status Reaction Delays</h3>
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2">Minimum React Delay (seconds)</label>
                    <input 
                      type="number"
                      value={botSettings.minReactDelay}
                      onChange={(e) => setBotSettings({...botSettings, minReactDelay: parseInt(e.target.value) || 0})}
                      className="w-full px-4 py-2.5 rounded-xl nm-outset outline-none text-slate-800 dark:text-slate-200 focus:nm-inset transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2">Maximum React Delay (seconds)</label>
                    <input 
                      type="number"
                      value={botSettings.maxReactDelay}
                      onChange={(e) => setBotSettings({...botSettings, maxReactDelay: parseInt(e.target.value) || 0})}
                      className="w-full px-4 py-2.5 rounded-xl nm-outset outline-none text-slate-800 dark:text-slate-200 focus:nm-inset transition-all"
                    />
                  </div>
                </div>

                {/* Emojis list */}
                <div className="p-6 rounded-2xl nm-inset space-y-4 md:col-span-2">
                  <h3 className="font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200/5 pb-2">General Tweaks</h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2">Reaction Chance (%)</label>
                      <input 
                        type="number"
                        min="0"
                        max="100"
                        value={botSettings.reactProbability}
                        onChange={(e) => setBotSettings({...botSettings, reactProbability: parseInt(e.target.value) || 0})}
                        className="w-full px-4 py-2.5 rounded-xl nm-outset outline-none text-slate-800 dark:text-slate-200 focus:nm-inset transition-all text-xs font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2">⚙️ Daily Auto-Like Reaction Cap</label>
                      <input 
                        type="number"
                        min="1"
                        max="5000"
                        value={botSettings.maxDailyReactions || 250}
                        onChange={(e) => setBotSettings({...botSettings, maxDailyReactions: parseInt(e.target.value) || 0})}
                        className="w-full px-4 py-2.5 rounded-xl nm-outset outline-none text-slate-800 dark:text-slate-200 focus:nm-inset transition-all text-xs font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2">Reaction Emojis (comma separated)</label>
                      <input 
                        type="text"
                        value={botSettings.emojis}
                        onChange={(e) => setBotSettings({...botSettings, emojis: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-xl nm-outset outline-none text-slate-800 dark:text-slate-200 focus:nm-inset transition-all text-xs font-semibold"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col space-y-3 pt-3">
                    <div className="flex items-center space-x-3">
                      <input 
                        type="checkbox"
                        id="autoSaveCheckbox"
                        checked={botSettings.autoSave}
                        onChange={(e) => setBotSettings({...botSettings, autoSave: e.target.checked})}
                        className="h-4 w-4 rounded nm-outset text-[#5a73a3]"
                      />
                      <label htmlFor="autoSaveCheckbox" className="text-xs font-bold text-slate-600 dark:text-slate-400 select-none">
                        Enable Auto-Save Contacts to Database
                      </label>
                    </div>

                    <div className="flex items-center space-x-3">
                      <input 
                        type="checkbox"
                        id="enableDeletedAlertCheckbox"
                        checked={botSettings.enableDeletedAlert}
                        onChange={(e) => setBotSettings({...botSettings, enableDeletedAlert: e.target.checked})}
                        className="h-4 w-4 rounded nm-outset text-[#5a73a3]"
                      />
                      <label htmlFor="enableDeletedAlertCheckbox" className="text-xs font-bold text-slate-600 dark:text-slate-400 select-none">
                        Enable Real-time WhatsApp DM Alerts for Deleted Messages
                      </label>
                    </div>

                    <div className="flex items-center space-x-3">
                      <input 
                        type="checkbox"
                        id="alwaysOfflineCheckbox"
                        checked={botSettings.alwaysOffline}
                        onChange={(e) => setBotSettings({...botSettings, alwaysOffline: e.target.checked})}
                        className="h-4 w-4 rounded nm-outset text-[#5a73a3]"
                      />
                      <label htmlFor="alwaysOfflineCheckbox" className="text-xs font-bold text-slate-600 dark:text-slate-400 select-none">
                        Always Offline Mode (Hide Always Online Status)
                      </label>
                    </div>

                    <div className="flex items-center space-x-3">
                      <input 
                        type="checkbox"
                        id="spamProtectionCheckbox"
                        checked={botSettings.spamProtection}
                        onChange={(e) => setBotSettings({...botSettings, spamProtection: e.target.checked})}
                        className="h-4 w-4 rounded nm-outset text-[#5a73a3]"
                      />
                      <label htmlFor="spamProtectionCheckbox" className="text-xs font-bold text-slate-600 dark:text-slate-400 select-none">
                        🛡️ Enable Inbox Anti-Spam Protection (Mutes spammers for 1 hour)
                      </label>
                    </div>
                  </div>
                </div>

                {/* Bot Owner Profile Details */}
                <div className="p-6 rounded-2xl nm-inset space-y-4 md:col-span-2">
                  <h3 className="font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200/5 pb-2">👤 Bot Owner Profile Details (Per-Device Settings)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2">Owner Name</label>
                      <input 
                        type="text"
                        value={botSettings.ownerName || ''}
                        onChange={(e) => setBotSettings({...botSettings, ownerName: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-xl nm-outset outline-none text-slate-800 dark:text-slate-200 focus:nm-inset transition-all text-xs font-semibold"
                        placeholder="e.g. චමිඳු"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2">Owner City/Village</label>
                      <input 
                        type="text"
                        value={botSettings.ownerCity || ''}
                        onChange={(e) => setBotSettings({...botSettings, ownerCity: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-xl nm-outset outline-none text-slate-800 dark:text-slate-200 focus:nm-inset transition-all text-xs font-semibold"
                        placeholder="e.g. ගාල්ල"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2">Owner Age</label>
                      <input 
                        type="text"
                        value={botSettings.ownerAge || ''}
                        onChange={(e) => setBotSettings({...botSettings, ownerAge: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-xl nm-outset outline-none text-slate-800 dark:text-slate-200 focus:nm-inset transition-all text-xs font-semibold"
                        placeholder="e.g. 18"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2">Owner Gender</label>
                      <input 
                        type="text"
                        value={botSettings.ownerGender || ''}
                        onChange={(e) => setBotSettings({...botSettings, ownerGender: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-xl nm-outset outline-none text-slate-800 dark:text-slate-200 focus:nm-inset transition-all text-xs font-semibold"
                        placeholder="e.g. Boy / Girl"
                      />
                    </div>
                  </div>
                </div>

                {/* Welcome & Questionnaire Editor */}
                <div className="p-6 rounded-2xl nm-inset space-y-4 md:col-span-2">
                  <h3 className="font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200/5 pb-2">Welcome Messages & Questionnaire Editor</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2">Welcome Connect Message (Sent when bot successfully links)</label>
                      <textarea 
                        rows="3"
                        value={botSettings.welcomeConnectMsg}
                        onChange={(e) => setBotSettings({...botSettings, welcomeConnectMsg: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-xl nm-outset outline-none text-slate-800 dark:text-slate-200 focus:nm-inset transition-all text-xs font-semibold"
                        placeholder="Use {pin} to insert generated login PIN dynamically..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2">Questionnaire Greeting Message (Sent when new contact first messages)</label>
                      <textarea 
                        rows="3"
                        value={botSettings.welcomeQuestionnaire}
                        onChange={(e) => setBotSettings({...botSettings, welcomeQuestionnaire: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-xl nm-outset outline-none text-slate-800 dark:text-slate-200 focus:nm-inset transition-all text-xs font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2">Questionnaire Processing/Saving Message (Sent after final answer, before success summary)</label>
                      <textarea 
                        rows="3"
                        value={botSettings.askProcessingMsg}
                        onChange={(e) => setBotSettings({...botSettings, askProcessingMsg: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-xl nm-outset outline-none text-slate-800 dark:text-slate-200 focus:nm-inset transition-all text-xs font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2">Questionnaire Success Message (Sent after details are successfully saved)</label>
                      <textarea 
                        rows="6"
                        value={botSettings.questionnaireSuccessMsg}
                        onChange={(e) => setBotSettings({...botSettings, questionnaireSuccessMsg: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-xl nm-outset outline-none text-slate-800 dark:text-slate-200 focus:nm-inset transition-all text-xs font-semibold"
                        placeholder="Use {name}, {city}, {age}, and {gender} to insert user answers dynamically..."
                      />
                      
                      <div className="mt-3">
                        <label className="block text-[11px] font-bold text-slate-400 mb-2">⭐ Success Message Layout Presets (Click to apply)</label>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 max-h-64 overflow-y-auto p-3 rounded-xl nm-inset bg-slate-50 dark:bg-slate-900">
                          {SUCCESS_MSG_TEMPLATES.map((tmpl) => {
                            const previewText = tmpl.text
                              .replace(/{ownerName}/g, 'Chamindu')
                              .replace(/{ownerCity}/g, 'galle')
                              .replace(/{ownerAge}/g, '18')
                              .replace(/{ownerGender}/g, 'Boy')
                              .replace(/{botNumber}/g, '94783314361')
                              .replace(/{name}/g, 'Sithija')
                              .replace(/{city}/g, 'colombo')
                              .replace(/{age}/g, '19')
                              .replace(/{gender}/g, 'Boy');
                            return (
                              <button
                                key={tmpl.id}
                                type="button"
                                onClick={() => setBotSettings({...botSettings, questionnaireSuccessMsg: tmpl.text})}
                                className="p-3 text-left rounded-xl nm-outset bg-white dark:bg-slate-800 text-[10px] leading-relaxed font-semibold hover:nm-inset transition-all border border-transparent hover:border-[#8ea9db] dark:hover:border-[#5a73a3] text-slate-700 dark:text-slate-300"
                              >
                                <span className="block text-[9px] font-bold text-[#8ea9db] dark:text-[#5a73a3] mb-1">{tmpl.title}</span>
                                <div className="whitespace-pre-wrap line-clamp-6">{previewText}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2">Google Contacts Name Saving Format Template</label>
                        <select 
                          value={
                            ['{name} 🤍 ({city}) - {age} - {gender}', '{name} 🌸 ({city}) - {age} - {gender}', '{name} ✨ ({city}) - {age} - {gender}', '{name} 🧸 ({city}) - {age} - {gender}', '{name} {emoji} ({city}) - {age} - {gender}'].includes(botSettings.contactNameFormat)
                              ? botSettings.contactNameFormat 
                              : 'custom'
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val !== 'custom') {
                              setBotSettings({...botSettings, contactNameFormat: val});
                            }
                          }}
                          className="w-full px-4 py-2.5 rounded-xl nm-outset outline-none text-slate-800 dark:text-slate-200 focus:nm-inset transition-all text-xs font-semibold bg-transparent"
                        >
                          <option value="{name} 🤍 ({city}) - {age} - {gender}">🤍 Love Style (Default)</option>
                          <option value="{name} 🌸 ({city}) - {age} - {gender}">🌸 Sweet Flower Style</option>
                          <option value="{name} ✨ ({city}) - {age} - {gender}">✨ Star/Friendly Style</option>
                          <option value="{name} 🧸 ({city}) - {age} - {gender}">🧸 Teddy Bear Style</option>
                          <option value="{name} {emoji} ({city}) - {age} - {gender}">🎲 Random Pretty Emoji Style</option>
                          <option value="custom">✏️ Custom Format Pattern...</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2">Custom Format Pattern String</label>
                        <input 
                          type="text"
                          value={botSettings.contactNameFormat}
                          onChange={(e) => setBotSettings({...botSettings, contactNameFormat: e.target.value})}
                          placeholder="{name} 🤍 ({city}) - {age} - {gender}"
                          className="w-full px-4 py-2.5 rounded-xl nm-outset outline-none text-slate-800 dark:text-slate-200 focus:nm-inset transition-all text-xs font-semibold"
                        />
                        <span className="text-[10px] text-slate-400 mt-1 block">Placeholders: <b>{`{name}`}</b>, <b>{`{city}`}</b>, <b>{`{age}`}</b>, <b>{`{gender}`}</b>, <b>{`{emoji}`}</b></span>
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="block text-[11px] font-bold text-slate-400 mb-2">⭐ Google Contacts Name Format Presets (Click to apply)</label>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 max-h-56 overflow-y-auto p-3 rounded-xl nm-inset bg-slate-50 dark:bg-slate-900">
                        {SUCCESS_TEMPLATES.map((tmpl) => {
                          const previewText = tmpl.text
                            .replace(/{name}/g, 'Chamindu')
                            .replace(/{city}/g, 'galle')
                            .replace(/{age}/g, '18')
                            .replace(/{gender}/g, 'Boy');
                          return (
                            <button
                              key={tmpl.id}
                              type="button"
                              onClick={() => setBotSettings({...botSettings, contactNameFormat: tmpl.text})}
                              className="p-3 text-left rounded-xl nm-outset bg-white dark:bg-slate-800 text-[10px] leading-relaxed font-semibold hover:nm-inset transition-all border border-transparent hover:border-[#8ea9db] dark:hover:border-[#5a73a3] text-slate-700 dark:text-slate-300"
                            >
                              <span className="block text-[9px] font-bold text-slate-400 mb-1">Preset {tmpl.id}</span>
                              <div className="whitespace-pre-wrap">{previewText}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2">Question 1: City/Village Request</label>
                        <input 
                          type="text"
                          value={botSettings.askCityMsg}
                          onChange={(e) => setBotSettings({...botSettings, askCityMsg: e.target.value})}
                          className="w-full px-4 py-2.5 rounded-xl nm-outset outline-none text-slate-800 dark:text-slate-200 focus:nm-inset transition-all text-xs font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2">Question 2: Age Request</label>
                        <input 
                          type="text"
                          value={botSettings.askAgeMsg}
                          onChange={(e) => setBotSettings({...botSettings, askAgeMsg: e.target.value})}
                          className="w-full px-4 py-2.5 rounded-xl nm-outset outline-none text-slate-800 dark:text-slate-200 focus:nm-inset transition-all text-xs font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2">Question 3: Gender Request</label>
                        <input 
                          type="text"
                          value={botSettings.askGenderMsg}
                          onChange={(e) => setBotSettings({...botSettings, askGenderMsg: e.target.value})}
                          className="w-full px-4 py-2.5 rounded-xl nm-outset outline-none text-slate-800 dark:text-slate-200 focus:nm-inset transition-all text-xs font-semibold"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Google Contacts Integration Card */}
                <div className="p-6 rounded-2xl nm-inset space-y-4 md:col-span-2">
                  <h3 className="font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200/5 pb-2">Google Contacts Integration</h3>
                  
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Link your Google Account to automatically upload and sync new auto-saved contacts to Google Contacts under the label <strong className="text-[#5a73a3] dark:text-[#8ea9db]">CHAMA-SHIELD</strong>.
                  </p>

                  <div className="pt-2">
                    {checkingGoogleAuth ? (
                      <div className="flex items-center space-x-2 text-xs text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Checking authentication...</span>
                      </div>
                    ) : googleAuthenticated ? (
                      <div className="space-y-4">
                        <div className="flex items-center space-x-2 text-sm text-emerald-600 dark:text-emerald-400 font-black">
                          <CheckCircle2 className="h-5 w-5" />
                          <span>Connected to Google Contacts</span>
                        </div>
                        <button 
                          type="button"
                          onClick={disconnectGoogle}
                          className="w-full sm:w-auto px-6 py-3.5 text-xs font-black text-rose-600 dark:text-rose-400 rounded-2xl nm-btn hover:scale-105 active:scale-95 transition-all flex items-center justify-center space-x-2 border border-rose-600/20"
                        >
                          Disconnect Google Account
                        </button>
                      </div>
                    ) : (
                      <button 
                        type="button"
                        onClick={connectGoogle}
                        className="w-full sm:w-auto px-10 py-5 text-sm font-black text-slate-800 dark:text-slate-100 rounded-3xl nm-btn hover:scale-105 active:scale-95 transition-all flex items-center justify-center space-x-3 border-2 border-slate-200 dark:border-slate-800 hover:border-[#4285F4] dark:hover:border-[#4285F4] animate-pulse"
                      >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        <span>LINK GOOGLE ACCOUNT (INSTANT SYNC)</span>
                      </button>
                    )}
                  </div>
                </div>

              </div>

              <div className="flex justify-end pt-4">
                <button 
                  type="submit" 
                  disabled={isSavingSettings}
                  className="px-6 py-3 rounded-xl nm-btn font-black text-slate-800 dark:text-slate-200 flex items-center space-x-2"
                >
                  {isSavingSettings ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Configurations</span>
                  )}
                </button>
              </div>
            </form>
          )}

        </main>
      </div>
    </div>
  );
}
