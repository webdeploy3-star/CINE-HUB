import React, { useState } from 'react';
import { 
  Shield, Key, User, Users, Sliders, ChevronLeft
} from 'lucide-react';

export default function Help() {
  const [lang, setLang] = useState('si'); // 'si' or 'en'

  const handleBack = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f172a] text-slate-800 dark:text-slate-200 py-10 px-4 transition-colors duration-300">
      <div className="max-w-3xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col items-center mb-8 relative">
          <button 
            onClick={handleBack}
            className="absolute left-0 top-0 p-2.5 rounded-xl nm-btn flex items-center space-x-1 hover:scale-105 transition-all text-xs font-bold text-slate-600 dark:text-slate-300"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Go Back</span>
          </button>
          
          <div className="w-12 h-12 rounded-2xl nm-outset flex items-center justify-center text-indigo-500 dark:text-indigo-400 mb-3 mt-12 sm:mt-0">
            <Shield className="h-6 w-6 animate-pulse" />
          </div>
          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">
            {lang === 'si' ? 'පරිශීලක අත්පොත' : 'User Manual'}
          </span>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-wider mt-1">
            💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘
          </h1>
        </div>

        {/* Language Tabs */}
        <div className="flex justify-center space-x-4 mb-8">
          <button 
            onClick={() => setLang('si')}
            className={`px-6 py-2.5 rounded-full text-xs font-bold transition-all shadow-md ${
              lang === 'si' 
                ? 'bg-indigo-600 text-white shadow-indigo-500/30' 
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            සිංහල (Sinhala)
          </button>
          <button 
            onClick={() => setLang('en')}
            className={`px-6 py-2.5 rounded-full text-xs font-bold transition-all shadow-md ${
              lang === 'en' 
                ? 'bg-indigo-600 text-white shadow-indigo-500/30' 
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            English
          </button>
        </div>

        {/* Content */}
        {lang === 'si' ? (
          <div className="space-y-6 animate-fade-in">
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50 shadow-sm flex flex-col space-y-3">
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <Key className="h-5 w-5 text-indigo-500" />
                <span>🔑 පියවර 01: වෙබ් පැනල් එකට ලොග් වීම (Login)</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">බොට් සාර්ථකව සම්බන්ධ වූ පසු ඔයාගේ වට්ස්ඇප් චැට් එකට ලැබුණු 6-Digit Login PIN එක සහ වෙබ් ලිංක් එක සොයාගන්න.</p>
              <ol className="list-decimal list-inside text-xs space-y-1.5 pl-1 text-slate-600 dark:text-slate-300">
                <li>වෙබ් ලිංක් එකට පිවිසෙන්න.</li>
                <li>ඔයාගේ බොට් නම්බර් එක සහ 6-Digit PIN එක ඇතුළත් කරන්න.</li>
                <li><strong>Unlock Dashboard</strong> ක්ලික් කර සාර්ථකව ලොග් වන්න.</li>
              </ol>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50 shadow-sm flex flex-col space-y-3">
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <Shield className="h-5 w-5 text-emerald-500" />
                <span>📥 පියවර 02: Auto-Save Contacts සක්‍රීය කිරීම</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">යූසර්ලා එවන තොරතුරු බොට් විසින් ඔටෝම ඩේටาබේස් එකට සේව් කරගැනීම ආරම්භ කිරීමට:</p>
              <ol className="list-decimal list-inside text-xs space-y-1.5 pl-1 text-slate-600 dark:text-slate-300">
                <li>වෙබ් පැනල් එකේ <strong>Settings</strong> ටැබ් එකට යන්න.</li>
                <li><strong>General Tweaks</strong> යටතේ ඇති <strong>"Enable Auto-Save Contacts to Database"</strong> කියන ටොගල් එක සක්‍රීය (Tick) කරන්න.</li>
                <li>පිටුවේ පහළටම ගොස් <strong>Save Settings</strong> බටන් එක ක්ලික් කරන්න.</li>
              </ol>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50 shadow-sm flex flex-col space-y-3">
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <Users className="h-5 w-5 text-blue-500" />
                <span>👥 පියවර 03: Google Contacts සමඟ සම්බන්ධ කිරීම (Sync)</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">ඩේටාබේස් එකට සේව් වෙන කන්ටැක්ට්ස් ඔටෝම ඔයාගේ ෆෝන් එකේ Google Contacts වලට සේව් කරගැනීමට:</p>
              <ol className="list-decimal list-inside text-xs space-y-1.5 pl-1 text-slate-600 dark:text-slate-300">
                <li><strong>Settings</strong> පැනල් එකේ ඇති <strong>"Google Contacts Sync"</strong> කොටසට යන්න.</li>
                <li>එහි ඇති <strong>"Sign in with Google"</strong> බටන් එක ක්ලික් කරන්න.</li>
                <li>ඔයාගේ කන්ටැක්ට්ස් සේව් කරගන්න අවශ්‍ය Gmail ගිණුම තෝරා අවසර (Allow Access) ලබාදෙන්න.</li>
                <li>සාර්ථකව සම්බන්ධ වූ පසු එහි <strong>"Status: Authorized"</strong> ලෙස කොළ පාටින් පෙන්වනු ඇත.</li>
              </ol>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50 shadow-sm flex flex-col space-y-3">
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <User className="h-5 w-5 text-indigo-500" />
                <span>✍️ පියවර 04: ප්‍රශ්නාවලිය (Questionnaire) සැකසීම</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">කන්ටැක්ට් එකක් සේව් කරගැනීමට පෙර බොට් විසින් යූසර්ට යවන ප්‍රශ්න මාලාව ඔයාට කැමති පරිදි වෙනස් කළ හැක:</p>
              <ul className="list-disc list-inside text-xs space-y-2 pl-1 text-slate-600 dark:text-slate-300">
                <li><strong>Welcome Message (පළමු පණිවිඩය):</strong> බොට් එකට මුලින්ම මැසේජ් එකක් දැමූ විට නම විමසමින් යන පණිවිඩය.</li>
                <li><strong>Ask City Message (ගම විමසීම):</strong> නම පැවසූ පසු ගම විමසන පණිවිඩය.</li>
                <li><strong>Ask Age Message (වයස විමසීම):</strong> ගම පැවසූ පසු වයස විමසන පණිවිඩය.</li>
                <li><strong>Ask Gender Message (ස්ත්‍රී/පුරුෂ භාවය):</strong> වයස පැවසූ පසු Girl/Boy ද යන්න විමසන පණිවිඩය.</li>
                <li><strong>Success Message:</strong> තොරතුරු සේව් වූ පසු යූසර්ට යන අවසාන ස්තූති පණිවිඩය. <span className="ml-1 text-[10px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">Templates 5කින් එකක් තෝරාගත හැක</span></li>
                <li><strong>Contact Name Format:</strong> ඔයාගේ ෆෝන් එකේ සේව් විය යුතු ආකාරය. <span className="ml-1 text-[10px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">Templates 31කින් කැමති එකක් තෝරාගත හැක</span></li>
              </ul>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50 shadow-sm flex flex-col space-y-3">
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <Sliders className="h-5 w-5 text-rose-500" />
                <span>🛡️ පියවර 05: ආරක්ෂක ක්‍රමවේද (Security Settings)</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">බොට් එක වට්ස්ඇප් එකෙන් බෑන් වීම වළැක්වීම සඳහා පැනල් එකේ ඇති පහත ආරක්ෂක ක්‍රමවේද නිවැරදිව සකසා ගන්න:</p>
              <ul className="list-disc list-inside text-xs space-y-2 pl-1 text-slate-600 dark:text-slate-300">
                <li><strong>Reaction Probability (%):</strong> ස්ටේටස් ලයික් කිරීමේ සම්භාවිතාව (අවම 80% ක් පමණ තැබීම නිර්දේශ කෙරේ).</li>
                <li><strong>Daily Auto-Like Reaction Cap:</strong> දිනකට උපරිම රියැක්ට් කරන ගණන (200-250 සීමාවක තැබීම සුදුසුය).</li>
                <li><strong>Enable Inbox Anti-Spam Protection:</strong> බොට් එකට එක දිගට මැසේජ් එවමින් වද දෙන spammersලාව පැයකට මියුට් කිරීමට මෙය සක්‍රීය කරන්න.</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in">
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50 shadow-sm flex flex-col space-y-3">
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <Key className="h-5 w-5 text-indigo-500" />
                <span>🔑 Step 01: Log In to the Web Panel</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Find the 6-digit Login PIN and dashboard link sent to your WhatsApp chat by the bot after connection.</p>
              <ol className="list-decimal list-inside text-xs space-y-1.5 pl-1 text-slate-600 dark:text-slate-300">
                <li>Open the web link in your browser.</li>
                <li>Enter your connected bot phone number and the 6-digit PIN.</li>
                <li>Click <strong>Unlock Dashboard</strong> to log in.</li>
              </ol>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50 shadow-sm flex flex-col space-y-3">
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800/50 shadow-sm flex flex-col space-y-3">
                <Shield className="h-5 w-5 text-emerald-500" />
                <span>📥 Step 02: Enable Auto-Save Contacts</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">To start saving questionnaire details to the database automatically:</p>
              <ol className="list-decimal list-inside text-xs space-y-1.5 pl-1 text-slate-600 dark:text-slate-300">
                <li>Go to the <strong>Settings</strong> tab in the web panel.</li>
                <li>Tick the checkbox for <strong>"Enable Auto-Save Contacts to Database"</strong> under General Tweaks.</li>
                <li>Scroll down and click <strong>Save Settings</strong>.</li>
              </ol>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50 shadow-sm flex flex-col space-y-3">
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <Users className="h-5 w-5 text-blue-500" />
                <span>👥 Step 03: Link with Google Contacts</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">To automatically sync saved contacts directly to your phone's Google Contacts:</p>
              <ol className="list-decimal list-inside text-xs space-y-1.5 pl-1 text-slate-600 dark:text-slate-300">
                <li>Navigate to the <strong>"Google Contacts Sync"</strong> section in Settings.</li>
                <li>Click the <strong>"Sign in with Google"</strong> button.</li>
                <li>Select the Google account where you want to sync the contacts and authorize permissions.</li>
                <li>Once successfully linked, it will show <strong>"Status: Authorized"</strong> in green.</li>
              </ol>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50 shadow-sm flex flex-col space-y-3">
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <User className="h-5 w-5 text-indigo-500" />
                <span>✍️ Step 04: Customize the Questionnaire</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">You can customize the questions the bot asks before saving the contact details:</p>
              <ul className="list-disc list-inside text-xs space-y-2 pl-1 text-slate-600 dark:text-slate-300">
                <li><strong>Welcome Message:</strong> The initial prompt sent to the user to ask for their name.</li>
                <li><strong>Ask City Message:</strong> Prompt sent after the user provides their name.</li>
                <li><strong>Ask Age Message:</strong> Prompt sent after the user provides their city.</li>
                <li><strong>Ask Gender Message:</strong> Prompt sent to ask if they are a Girl or a Boy.</li>
                <li><strong>Success Message:</strong> The final thank-you message sent once details are saved. <span className="ml-1 text-[10px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">5 Presets available</span></li>
                <li><strong>Contact Name Format:</strong> The format in which the contact name will be saved in your phone. <span className="ml-1 text-[10px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">31 Templates available</span></li>
              </ul>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50 shadow-sm flex flex-col space-y-3">
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <Sliders className="h-5 w-5 text-rose-500" />
                <span>🛡️ Step 05: Security & Anti-Ban Tuning</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">To protect your account from getting flagged or banned by WhatsApp's spam filters:</p>
              <ul className="list-disc list-inside text-xs space-y-2 pl-1 text-slate-600 dark:text-slate-300">
                <li><strong>Reaction Probability (%):</strong> The likelihood of liking status slides (80% or 85% is highly recommended).</li>
                <li><strong>Daily Auto-Like Reaction Cap:</strong> The maximum number of status likes allowed per day (capped at 200-250 for safety).</li>
                <li><strong>Enable Inbox Anti-Spam Protection:</strong> Enable this to mute spammers for 1 hour if they spam messages in private DMs.</li>
              </ul>
            </div>
          </div>
        )}

        <footer className="text-center mt-10 pt-6 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500">
          <p>🕊️ Powered by 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘 Control Engine</p>
        </footer>
      </div>
    </div>
  );
}
