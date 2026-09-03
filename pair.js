
import dns from 'dns';
try {
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {
    console.warn('Failed to set custom DNS servers programmatically:', e.message);
}

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import express from 'express';
import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import pino from 'pino';
import mongoose from 'mongoose';
import moment from 'moment-timezone';
import axios from 'axios';
import https from 'https';
import os from 'os';
import { Jimp } from 'jimp';
import NodeCache from 'node-cache';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import yts from 'yt-search';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

import makeWASocket, {
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    downloadContentFromMessage,
    jidNormalizedUser,
    proto,
    prepareWAMessageMedia,
    downloadMediaMessage,
    generateForwardMessageContent,
    generateWAMessageFromContent,
    fetchLatestWaWebVersion,
    getBinaryNodeChild,
    getBinaryNodeChildren,
    BufferJSON
} from '@whiskeysockets/baileys';

const router = express.Router();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const insecureAgent = new https.Agent({
    rejectUnauthorized: false
});

function getPublicUrl() {
    if (process.env.SERVER_URL) return process.env.SERVER_URL.replace(/\/$/, '');
    if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
    if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
    return 'https://cine-hub-production.up.railway.app/';
}

const config = {
  CLIENT_ID: process.env.CLIENT_ID || '895028481695-5npuqo1haqmvbt79e2lfb37gapf8c5cf.apps.googleusercontent.com',
  CLIENT_SECRET: process.env.CLIENT_SECRET || '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',
  AUTO_VIEW_STATUS: 'true',
  AUTO_LIKE_STATUS: 'true',
  AUTO_LIKE_EMOJI: ['💙'],
  BOT_NAME: '🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘',
  BOT_FOOTER: '💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘',
  MODE: 'public', 
  MAX_RETRIES: 3,
  ADMIN_LIST_PATH: './admin.json',
  NEWSLETTER_JID: '120363412101228151@newsletter',
  NEWSLETTER_MESSAGE_ID: '428',
  OTP_EXPIRY: 300000,
  MONGODB_URL: 'mongodb+srv://dct-dula:dct-ninja-x-md@dctninja.gxfynay.mongodb.net/?appName=dctninja', 
  CHANNEL_LINK: 'https://whatsapp.com/channel/0029VbCi5BT5a23yioUIOp1w'
};


const activeSockets = new Map();

const socketCreationTime = new Map();
const SESSION_BASE_PATH = path.join('.', config.BOT_NAME || '💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘');
const NUMBER_LIST_PATH = './numbers.json';
const SessionSchema = new mongoose.Schema({
    number: { type: String, unique: true, required: true },
    lid: { type: String },
    creds: { type: Object, required: true },
    config: { type: Object },
    googleTokens: { type: Object },
    updatedAt: { type: Date, default: Date.now }
});
SessionSchema.index({ lid: 1 });
const Session = mongoose.model('Session', SessionSchema);

const SessionKeyStoreSchema = new mongoose.Schema({
    number: { type: String, required: true },
    category: { type: String, required: true },
    keyId: { type: String, required: true },
    value: { type: String }
});
SessionKeyStoreSchema.index({ number: 1, category: 1, keyId: 1 }, { unique: true });
const SessionKeyStore = mongoose.model('SessionKeyStore', SessionKeyStoreSchema);

// Mongoose schema for auto-saved contacts
const SavedContactSchema = new mongoose.Schema({
    botNumber: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    name: { type: String, required: true },
    city: { type: String, required: true },
    age: { type: String, required: true },
    gender: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
SavedContactSchema.index({ botNumber: 1, phoneNumber: 1 }, { unique: true });
const SavedContact = mongoose.model('SavedContact', SavedContactSchema);

// Mongoose schema for newsletter channel auto-react configurations
const AutoReactSchema = new mongoose.Schema({
    botNumber: { type: String, required: true },
    channelJid: { type: String, required: true },
    channelName: { type: String, required: true },
    inviteCode: { type: String },
    emojis: { type: [String], default: ['❤️', '🔥', '😍', '👍'] },
    createdAt: { type: Date, default: Date.now }
});
AutoReactSchema.index({ botNumber: 1, channelJid: 1 }, { unique: true });
const AutoReact = mongoose.models.AutoReact || mongoose.model('AutoReact', AutoReactSchema);


const localMessageCache = new NodeCache({ stdTTL: 7200, useClones: false });

// Scalability & Performance Optimization Caches
const configCache = new NodeCache({ stdTTL: 300, useClones: false });
const autoReactCache = new NodeCache({ stdTTL: 600, useClones: false });

function parseSizeToMB(sizeStr) {
    if (!sizeStr) return 0;
    const cleanStr = sizeStr.toLowerCase().replace(/[^0-9.]/g, '').trim();
    const val = parseFloat(cleanStr);
    if (isNaN(val)) return 0;
    if (sizeStr.toLowerCase().includes('gb')) {
        return val * 1024;
    }
    return val; // assumed MB
}

// Global batch queue for SessionKeyStore bulk operations to prevent DB locks
const pendingKeyStoreOps = [];
let keyStoreFlushTimeout = null;

async function flushKeyStoreQueue() {
    if (pendingKeyStoreOps.length === 0) return;
    const opsToFlush = [...pendingKeyStoreOps];
    pendingKeyStoreOps.length = 0;
    keyStoreFlushTimeout = null;
    try {
        await SessionKeyStore.bulkWrite(opsToFlush, { ordered: false });
    } catch (err) {
        console.error('[DB KeyStore Queue] Bulk write failed:', err.message);
    }
}

function queueKeyStoreOps(ops) {
    pendingKeyStoreOps.push(...ops);
    if (pendingKeyStoreOps.length >= 500) {
        if (keyStoreFlushTimeout) {
            clearTimeout(keyStoreFlushTimeout);
        }
        flushKeyStoreQueue();
    } else if (!keyStoreFlushTimeout) {
        keyStoreFlushTimeout = setTimeout(flushKeyStoreQueue, 1500);
    }
}

// Helper to save deleted message logs locally inside session directory
async function saveDeletedMessageLocally(sanitizedNumber, logEntry) {
    try {
        const filePath = path.join(SESSION_BASE_PATH, `Bot_${sanitizedNumber}`, 'deleted_messages.json');
        let logs = [];
        if (fs.existsSync(filePath)) {
            try {
                logs = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            } catch (e) {
                logs = [];
            }
        }
        logs.unshift(logEntry);
        if (logs.length > 500) {
            logs = logs.slice(0, 500);
        }
        fs.ensureDirSync(path.dirname(filePath));
        fs.writeFileSync(filePath, JSON.stringify(logs, null, 2));
    } catch (error) {
        console.error('Failed to save deleted message locally:', error.message);
    }
}

// Helper to load deleted message logs from local session directory
async function getLocalDeletedMessages(sanitizedNumber) {
    try {
        const filePath = path.join(SESSION_BASE_PATH, `Bot_${sanitizedNumber}`, 'deleted_messages.json');
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (e) {
        // Fallback or file does not exist
    }
    return [];
}

async function processAntiDeleteAlert(socket, sanitizedNumber, savedMsg) {
    try {
        if (savedMsg && savedMsg.message) {
            if (savedMsg.key.fromMe) return; // Ignore own deleted messages

            console.log(`[Anti-Delete] Intercepted deleted message from ${savedMsg.pushName || 'Someone'}`);

            const sessionConfig = activeSockets.get(sanitizedNumber)?.config || {};
            if (sessionConfig.ENABLE_DELETED_ALERT !== 'false') {
                try {
                    const ownerJid = `${sanitizedNumber}@s.whatsapp.net`;
                    
                    // Extract sender number & details
                    let senderJid = savedMsg.key.participant || savedMsg.key.remoteJid;
                    if (senderJid.endsWith('@lid')) {
                        const pnJid = await resolveJidToPn(socket, senderJid);
                        if (pnJid) senderJid = pnJid;
                    }
                    const senderNumber = senderJid.split('@')[0];
                    const senderName = savedMsg.pushName || senderNumber;

                    const timeStr = moment(savedMsg.messageTimestamp * 1000).tz('Asia/Colombo').format('hh:mm A');
                    const chatContext = savedMsg.key.remoteJid.endsWith('@g.us') ? 'Group Chat' : 'Private Chat';
                    
                    // Extract text content if present
                    const deletedText = savedMsg.message.conversation || 
                                        savedMsg.message.extendedTextMessage?.text || 
                                        savedMsg.message.imageMessage?.caption || 
                                        savedMsg.message.videoMessage?.caption || '';

                    let alertMsg = `🛡️ *🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD ᴀɴᴛɪ-ᴅᴇʟᴇᴛᴇ ᴀʟᴇʀᴛ* 🛡️\n\n` +
                        `👤 *Sender:* ${senderName} (+${senderNumber})\n` +
                        `💬 *Chat:* ${chatContext}\n` +
                        `⏰ *Time:* ${timeStr}\n\n`;

                    const mediaType = Object.keys(savedMsg.message)[0];

                    if (deletedText) {
                        alertMsg += `📝 *Deleted Content:* \n${deletedText}`;
                        await socket.sendMessage(ownerJid, { text: alertMsg, mentions: [senderJid] }, { quoted: savedMsg });
                    } else {
                        alertMsg += `📦 *Deleted Media Type:* ${mediaType}`;
                        
                        await socket.sendMessage(ownerJid, { text: alertMsg, mentions: [senderJid] });
                        await socket.sendMessage(ownerJid, { forward: savedMsg }, { quoted: savedMsg });
                    }

                    // Save log locally for web dashboard access
                    const logEntry = {
                        id: savedMsg.key.id,
                        sender: senderName,
                        senderNumber: senderNumber,
                        chat: chatContext,
                        time: timeStr,
                        timestamp: Date.now(),
                        content: deletedText || `[Media Message: ${mediaType || 'unknown'}]`
                    };
                    await saveDeletedMessageLocally(sanitizedNumber, logEntry);

                    console.log(`[Anti-Delete Alert] Successfully forwarded alert to owner: ${ownerJid}`);
                } catch (alertErr) {
                    console.error('[Anti-Delete Alert] Failed to send forward alert:', alertErr.message);
                }
            }
        }
    } catch (err) {
        console.error('Error logging deleted message:', err);
    }
}

// Global status tracking for session pairings
if (!global.sessionStatuses) global.sessionStatuses = new Map();

const inboxStates = new Map();

// Helper to check/refresh Google token
async function getGoogleAccessToken(sanitizedNumber) {
    const tokenPath = path.join(SESSION_BASE_PATH, `Bot_${sanitizedNumber}`, 'google_tokens.json');
    
    // Attempt to restore from MongoDB if local tokens file was formatted/deleted by stateless containers
    if (!fs.existsSync(tokenPath)) {
        try {
            const session = await Session.findOne({ number: sanitizedNumber });
            if (session && session.googleTokens) {
                const tokenFolder = path.dirname(tokenPath);
                fs.ensureDirSync(tokenFolder);
                fs.writeFileSync(tokenPath, JSON.stringify(session.googleTokens, null, 2));
                console.log(`[Google Tokens] Successfully restored from MongoDB for ${sanitizedNumber}`);
            } else {
                return null;
            }
        } catch (dbErr) {
            console.error('Failed to restore Google tokens from MongoDB:', dbErr.message);
            return null;
        }
    }

    try {
        const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        if (Date.now() > tokens.expiry_date) {
            console.log(`Google access token expired for ${sanitizedNumber}. Refreshing...`);
            const response = await axios.post('https://oauth2.googleapis.com/token', {
                client_id: config.CLIENT_ID,
                client_secret: config.CLIENT_SECRET,
                refresh_token: tokens.refresh_token,
                grant_type: 'refresh_token'
            });
            const newTokens = response.data;
            tokens.access_token = newTokens.access_token;
            tokens.expiry_date = Date.now() + (newTokens.expires_in * 1000);
            fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
            // Back up refreshed tokens back to MongoDB
            await Session.updateOne({ number: sanitizedNumber }, { googleTokens: tokens });
            return tokens.access_token;
        }
        return tokens.access_token;
    } catch (error) {
        console.error('Failed to get/refresh Google token:', error.response?.data || error.message);
        return null;
    }
}

// Search Google Contacts by phone number
async function searchGoogleContact(accessToken, phoneNumber) {
    try {
        const response = await axios.get('https://people.googleapis.com/v1/people:searchContacts', {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: {
                query: phoneNumber,
                readMask: 'names,phoneNumbers'
            }
        });
        const results = response.data.results || [];
        return results.length > 0;
    } catch (error) {
        console.error('Google searchContacts error:', error.response?.data || error.message);
        return false;
    }
}

// Create a new contact in Google Contacts
async function createGoogleContact(accessToken, contactData) {
    try {
        const body = {
            names: [
                {
                    givenName: contactData.formattedName || contactData.name,
                    familyName: contactData.formattedName ? '' : `(${contactData.city || 'N/A'}) - ${contactData.age || 'N/A'} - ${contactData.gender || 'N/A'}`
                }
            ],
            phoneNumbers: [
                {
                    value: contactData.phone,
                    type: 'mobile'
                }
            ],
            biographies: [
                {
                    value: `Age: ${contactData.age}\nGender: ${contactData.gender}\nSaved by 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘`,
                    contentType: 'TEXT_PLAIN'
                }
            ]
        };
        await axios.post('https://people.googleapis.com/v1/people:createContact', body, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        return true;
    } catch (error) {
        console.error('Google createContact error:', error.response?.data || error.message);
        return false;
    }
}

async function connectMongoDB() {
    try {
        const mongoUri = config.MONGODB_URL || process.env.MONGO_URI || 'mongodb+srv://ccransika_db_user:Pc1u7xrzGEn4LJvw@cluster0.sntej6n.mongodb.net/CHAMA-NEW-BOTS';
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            bufferCommands: false,
            maxPoolSize: 10,
            minPoolSize: 2,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 30000
        });
        console.log(`
╔══════════════════════════════════════╗
║     💎  💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD CONNECT 💎      ║
╠══════════════════════════════════════╣
║  ✅ MongoDB Connected Successfully   ║
║  ⚡ System Status : ONLINE           ║
║  💻 Bot Engine   : 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD      ║
╚══════════════════════════════════════╝
`);
        await initialize();
        setTimeout(autoReconnectOnStartup, 1000);
    } catch (error) {
        console.error('MongoDB connection failed:', error);
        process.exit(1);
    }
}
connectMongoDB();
if (!fs.existsSync(SESSION_BASE_PATH)) {
    fs.mkdirSync(SESSION_BASE_PATH, { recursive: true });
}

async function initialize() {
    activeSockets.clear();
    socketCreationTime.clear();
    console.log('Cleared active sockets and creation times on startup');
}

async function autoReconnectOnStartup() {
    try {
        // Clean up invalid session documents from MongoDB
        try {
            await Session.deleteMany({
                $or: [
                    { number: "" },
                    { number: "0" },
                    { number: "new_session" },
                    { number: /[^0-9]/ }
                ]
            });
        } catch (dbErr) {
            console.error('Error cleaning up invalid DB sessions:', dbErr.message);
        }

        // Clean up numbers.json
        if (fs.existsSync(NUMBER_LIST_PATH)) {
            try {
                let fileNumbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH, 'utf8'));
                if (Array.isArray(fileNumbers)) {
                    fileNumbers = fileNumbers.filter(n => typeof n === 'string' && /^[0-9]+$/.test(n) && n !== '0');
                    fs.writeFileSync(NUMBER_LIST_PATH, JSON.stringify(fileNumbers, null, 2));
                }
            } catch (fsErr) {
                console.error('Error cleaning up numbers.json:', fsErr.message);
            }
        }

        let numbers = [];
        if (fs.existsSync(NUMBER_LIST_PATH)) {
            numbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH, 'utf8'));
            console.log(`Loaded ${(numbers.length)} numbers from numbers.json`);
        } else {
            console.warn(`
[ 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD WARNING]

>> numbers.json file not detected ⚠️
>> Switching to MongoDB session lookup...
>> Please wait... 🔍

[!] Fallback system activated
`);

        }

        const sessions = await Session.find({}, 'number').lean();
        const mongoNumbers = sessions.map(s => s.number);
        console.log(`Found ${mongoNumbers.length} numbers in MongoDB sessions`);

        numbers = [...new Set([...numbers, ...mongoNumbers])].filter(n => typeof n === 'string' && /^[0-9]+$/.test(n) && n !== '0');
        if (numbers.length === 0) {
            console.log('No numbers found in numbers.json or MongoDB, skipping auto-reconnect');
            return;
        }

        console.log(`Attempting to reconnect ${numbers.length} sessions...`);
        for (const number of numbers) {
            if (activeSockets.has(number)) {
                console.log(`Number ${number} already connected, skipping`);
                continue;
            }
            
            const creds = await restoreSession(number);
            if (!creds) {
                console.log(`Skipping reconnect for unregistered session: ${number}`);
                continue;
            }
            
            const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
            try {
                await EmpirePair(number, mockRes, 'reconnect');
                console.log(`Initiated reconnect for ${number}`);
            } catch (error) {
                console.error(`Failed to reconnect ${number}:`, error);
            }
            await delay(1000);
        }
    } catch (error) {
        console.error('Auto-reconnect on startup failed:', error);
    }
}

initialize();

function loadAdmins() {
    try {
        if (fs.existsSync(config.ADMIN_LIST_PATH)) {
            return JSON.parse(fs.readFileSync(config.ADMIN_LIST_PATH, 'utf8'));
        }
        return [];
    } catch (error) {
        console.error('Failed to load admin list:', error);
        return [];
    }
}

function formatMessage(title, content, footer) {
    return `*${title}*\n\n${content}\n\n> *${footer}*`;
}

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function getSriLankaTimestamp() {
    return moment().tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss');
}

function extractYouTubeId(url) {
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|playlist\?list=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

function getEpisodeName(name, url) {
    try {
        if (url) {
            const urlObj = new URL(url);
            const filename = urlObj.pathname.split('/').pop();
            if (filename) {
                return decodeURIComponent(filename)
                    .replace('.(THENKIRI.COM).mkv', '')
                    .replace('.(THENKIRI.COM).mp4', '')
                    .replace('.mkv', '')
                    .replace('.mp4', '');
            }
        }
    } catch (e) {}
    if (name) {
        return name
            .replace('🎥 [Movie File] [N/A] Wella ', '')
            .replace('🎥 ', '')
            .replace(/ via .*/, '')
            .trim();
    }
    return 'Episode';
}

async function getThumbnailBuffer(url) {
    try {
        if (!url) return undefined;
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
        return Buffer.from(res.data);
    } catch (e) {
        console.warn('Failed to fetch thumbnail buffer:', e.message);
        return undefined;
    }
}

function convertYouTubeLink(q) {
    const videoId = extractYouTubeId(q);
    if (videoId) {
        return `https://www.youtube.com/watch?v=${videoId}`;
    }
    return q;
}
async function resolveJidToPn(socket, jid) {
    if (!jid) return '';
    if (jid.endsWith('@s.whatsapp.net')) return jid;
    if (jid.endsWith('@lid')) {
        try {
            if (socket?.signalRepository?.lidMapping?.getPNForLID) {
                const pn = await socket.signalRepository.lidMapping.getPNForLID(jid);
                if (pn) return pn;
            }
        } catch (err) {
            console.error('Failed to map LID to PN via signalRepository:', err.message);
        }
        try {
            const map = socket?.authState?.creds?.phoneNumberMap;
            if (map && map[jid]) {
                return map[jid];
            }
        } catch (err) {}
    }
    return jid;
}



async function sendInteractiveMessage(socket, data, options = {}) {
    const buttons = (data.buttons || []).map(btn => {
        if (btn.type === 'entry_point') {
            return {
                name: 'entry_point',
                buttonParamsJson: JSON.stringify({
                    display_text: btn.text,
                    id: btn.id
                })
            };
        }
        return {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
                display_text: btn.text,
                id: btn.id
            })
        };
    });

    const msg = generateWAMessageFromContent(data.jid, {
        viewOnceMessage: {
            message: {
                messageContextInfo: {
                    deviceListMetadata: {},
                    deviceListMetadataVersion: 2
                },
                interactiveMessage: {
                    header: {
                        title: data.header || '',
                        hasMediaAttachment: false
                    },
                    body: {
                        text: data.text
                    },
                    footer: {
                        text: data.footer || ''
                    },
                    nativeFlowMessage: {
                        buttons,
                        messageParamsJson: ''
                    }
                }
            }
        }
    }, { quoted: options.quoted });

    return socket.relayMessage(data.jid, msg.message, { messageId: msg.key.id });
}

async function downloadContent(message) {
    if (!message) throw new Error('No message content');
    
    const buffer = await downloadContentFromMessage(message, 'buffer');
    return buffer;
}
async function streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}


async function joinGroup(socket) {
    let retries = config.MAX_RETRIES || 3;
    const inviteLink = config.GROUP_INVITE_LINK || process.env.GROUP_INVITE_LINK;
    if (!inviteLink) {
        console.log('No GROUP_INVITE_LINK configured, skipping auto-join.');
        return { status: 'failed', error: 'No invite link' };
    }
    const inviteCodeMatch = inviteLink.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/);
    if (!inviteCodeMatch) {
    
        return { status: 'failed', error: 'Invalid group invite link' };
    }
    const inviteCode = inviteCodeMatch[1];

    while (retries > 0) {
        try {
            const response = await socket.groupAcceptInvite(inviteCode);
            if (response?.gid) {
               
                return { status: 'success', gid: response.gid };
            }
            throw new Error('No group ID in response');
        } catch (error) {
            retries--;
            let errorMessage = error.message || 'Unknown error';
            if (error.message.includes('not-authorized')) {
                errorMessage = 'Bot is not authorized to join (possibly banned)';
            } else if (error.message.includes('conflict')) {
                errorMessage = 'Bot is already a member of the group';
            } else if (error.message.includes('gone')) {
                errorMessage = 'Group invite link is invalid or expired';
            }
          
            if (retries === 0) {
                return { status: 'failed', error: errorMessage };
            }
            await delay(2000 * (config.MAX_RETRIES - retries));
        }
    }
    return { status: 'failed', error: 'Max retries reached' };
}


const reactedNewsletterMsgs = new Set();

function setupNewsletterHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message?.key || !message.key.remoteJid) return;

        // Dynamic newsletter auto-react handler
        if (message.key.remoteJid.endsWith('@newsletter')) {
            const channelJid = message.key.remoteJid;
            const botNumber = socket.user?.id?.split(':')[0];
            if (!botNumber) return;

            try {
                // Check if this channel is registered for auto-react or is the config.NEWSLETTER_JID
                let emojis = ['❤️', '🔥', '😍', '👍'];
                if (channelJid === config.NEWSLETTER_JID) {
                    emojis = ['🧡', '💛', '💚', '💙', '💜', '❤️', '👍'];
                } else {
                    // Check cache first
                    const cacheKey = `${botNumber}_${channelJid}`;
                    let cachedEmojis = autoReactCache.get(cacheKey);
                    if (cachedEmojis === null) return; // Cached non-registered channel

                    if (cachedEmojis) {
                        emojis = cachedEmojis;
                    } else {
                        const configDoc = await AutoReact.findOne({ botNumber, channelJid });
                        if (!configDoc) {
                            autoReactCache.set(cacheKey, null); // Cache negative result
                            return;
                        }
                        emojis = configDoc.emojis || emojis;
                        autoReactCache.set(cacheKey, emojis);
                    }
                }

                const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

                const serverId = message.newsletterServerId 
                    ? message.newsletterServerId.toString() 
                    : (message.key && message.key.server_id ? message.key.server_id.toString() : null);

                if (!serverId) return;

                if (reactedNewsletterMsgs.has(serverId)) return;
                reactedNewsletterMsgs.add(serverId);

                // Antiban delay (3s) to prevent spam flags
                await delay(3000);

                let retries = 3;
                while (retries > 0) {
                    try {
                        await socket.newsletterReactMessage(
                            channelJid,
                            serverId,
                            randomEmoji
                        );
                        console.log(`Reacted to newsletter message ${serverId} in ${channelJid} with ${randomEmoji}`);
                        break;
                    } catch (error) {
                        retries--;
                        console.warn(`Failed to react to newsletter message ${serverId} in ${channelJid}, retries left: ${retries}`, error.message);
                        if (retries === 0) throw error;
                        await delay(2000 * (3 - retries));
                    }
                }
            } catch (error) {
                console.error('Newsletter auto-react error:', error);
            }
        }
    });

    socket.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
            const jid = update.key.remoteJid;
            if (!jid || !jid.endsWith('@newsletter')) continue;

            const serverId = update.key.server_id ? update.key.server_id.toString() : null;
            if (!serverId) continue;

            if (reactedNewsletterMsgs.has(serverId)) continue;
            reactedNewsletterMsgs.add(serverId);

            const botNumber = socket.user?.id?.split(':')[0];
            if (!botNumber) continue;

            try {
                let emojis = ['❤️', '🔥', '😍', '👍'];
                if (jid === config.NEWSLETTER_JID) {
                    emojis = ['🧡', '💛', '💚', '💙', '💜', '❤️', '👍'];
                } else {
                    const configDoc = await AutoReact.findOne({ botNumber, channelJid: jid });
                    if (!configDoc) continue;
                    emojis = configDoc.emojis || emojis;
                }

                const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

                console.log(`[Newsletter Msg Update] Found server ID ${serverId} for message ${update.key.id}. Triggering auto-react...`);

                // Antiban delay (3s) to prevent spam flags
                await delay(3000);

                let retries = 3;
                while (retries > 0) {
                    try {
                        await socket.newsletterReactMessage(
                            jid,
                            serverId,
                            randomEmoji
                        );
                        console.log(`Reacted to newsletter message update ${serverId} in ${jid} with ${randomEmoji}`);
                        break;
                    } catch (error) {
                        retries--;
                        console.warn(`Failed to react to newsletter message update ${serverId} in ${jid}, retries left: ${retries}`, error.message);
                        if (retries === 0) throw error;
                        await delay(2000 * (3 - retries));
                    }
                }
            } catch (error) {
                console.error('Newsletter update auto-react error:', error);
            }
        }
    });
}

const lastStatusProcessTime = new Map();
const seenStatuses = new Set();
const mutedSenders = new Map();
const messageCounters = new Map();

async function queueStatusView(socket, msg) {
    const statusKeyId = msg.key.id;
    if (seenStatuses.has(statusKeyId)) {
        return;
    }
    seenStatuses.add(statusKeyId);
    if (seenStatuses.size > 2000) {
        const firstKey = seenStatuses.values().next().value;
        seenStatuses.delete(firstKey);
    }

    const botJid = jidNormalizedUser(socket.user.id);
    const isOwnStatus = msg.key.participant === botJid;
    const sanitizedNumber = botJid.split('@')[0].replace(/[^0-9]/g, '');
    const sessionConfig = activeSockets.get(sanitizedNumber)?.config || config;

    // Dynamic Delay from settings or fallback (15s to 90s)
    const minDelaySec = parseInt(sessionConfig.MIN_VIEW_DELAY) || 15;
    const maxDelaySec = parseInt(sessionConfig.MAX_VIEW_DELAY) || 90;
    let minDelay = minDelaySec * 1000;
    let maxDelay = maxDelaySec * 1000;

    // Human Sleep Simulation: between 12:00 AM and 6:00 AM, scale delays to look like DND sleeping hours
    const currentHour = new Date().getHours();
    const isLateNight = currentHour >= 0 && currentHour < 6;
    let nightReactMultiplier = 1;
    if (isLateNight) {
        const nightFactor = 8 + Math.random() * 17;
        minDelay = minDelay * nightFactor;
        maxDelay = maxDelay * nightFactor;
        nightReactMultiplier = 0.25; // 4x lower probability of reacting during sleep
        console.log(`[Status View] [Sleepy Mode Active] nocturnal delay scaling activated for ${msg.key.participant}`);
    }

    const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

    // Anti-burst scheduler: enforce a minimum 12-second spacing gap between consecutive status processes
    let scheduledTime = Date.now() + randomDelay;
    const lastTime = lastStatusProcessTime.get(sanitizedNumber) || 0;
    if (scheduledTime - lastTime < 12000) {
        scheduledTime = lastTime + 12000 + Math.floor(Math.random() * 8000);
    }
    lastStatusProcessTime.set(sanitizedNumber, scheduledTime);
    const finalDelay = Math.max(1000, scheduledTime - Date.now());

    console.log(`[Status View] Anti-Ban queueing status view/react for ${msg.key.participant} in ${(finalDelay / 1000).toFixed(1)}s`);

    setTimeout(async () => {
        try {
            const activeSession = activeSockets.get(sanitizedNumber);
            if (!activeSession || !activeSession.socket) {
                console.warn(`[Status View] No active socket found for ${sanitizedNumber}, skipping delayed status view`);
                return;
            }
            const activeSocket = activeSession.socket;

            // 1. View / read status
            if (sessionConfig.AUTO_VIEW_STATUS === 'true') {
                let retries = config.MAX_RETRIES;
                while (retries > 0) {
                    try {
                        await activeSocket.readMessages([msg.key]);
                        break;
                    } catch (error) {
                        retries--;
                        console.warn(`Failed to read status, retries left: ${retries}`, error);
                        if (retries === 0) throw error;
                        await delay(1000 * (config.MAX_RETRIES - retries));
                    }
                }
            }

            // 2. React to status with secondary delayed human-like action
            const baseReactChance = parseInt(sessionConfig.REACT_PROBABILITY) || 85;
            const reactChance = isLateNight ? Math.max(10, Math.floor(baseReactChance * nightReactMultiplier)) : baseReactChance;
            const roll = Math.floor(Math.random() * 100);
            if (sessionConfig.AUTO_LIKE_STATUS === 'true' && !isOwnStatus && roll < reactChance) {
                // --- DAILY REACTION CAP CHECK ---
                const maxDaily = parseInt(sessionConfig.MAX_DAILY_REACTIONS) || 250;
                const todayStr = moment().tz('Asia/Colombo').format('YYYY-MM-DD');
                const lastResetDate = sessionConfig.LAST_REACTIONS_RESET_DATE || '';
                let dailyCount = parseInt(sessionConfig.DAILY_REACTIONS_COUNT) || 0;

                if (lastResetDate !== todayStr) {
                    dailyCount = 0;
                    sessionConfig.LAST_REACTIONS_RESET_DATE = todayStr;
                    sessionConfig.DAILY_REACTIONS_COUNT = '0';
                    // Update config in DB asynchronously
                    Session.updateOne(
                        { number: sanitizedNumber },
                        { $set: { "config.LAST_REACTIONS_RESET_DATE": todayStr, "config.DAILY_REACTIONS_COUNT": "0" } }
                    ).catch(e => console.error('Failed to reset daily reactions in DB:', e.message));
                }

                if (dailyCount >= maxDaily) {
                    console.log(`[Status View] [Reaction Cap Exceeded] Daily limit of ${maxDaily} reached for ${sanitizedNumber}, skipping reaction.`);
                    return;
                }
                // ---------------------------------

                const minReactSec = parseInt(sessionConfig.MIN_REACT_DELAY) || 5;
                const maxReactSec = parseInt(sessionConfig.MAX_REACT_DELAY) || 20;
                const reactDelay = (Math.floor(Math.random() * (maxReactSec - minReactSec + 1)) + minReactSec) * 1000;
                
                setTimeout(async () => {
                    try {
                        const currentSession = activeSockets.get(sanitizedNumber);
                        if (!currentSession || !currentSession.socket) return;
                        const currentSocket = currentSession.socket;

                        const reactEmojiStr = sessionConfig.AUTO_LIKE_EMOJI || '🧩, 🍉, 💜, 🌸, 🪴, 💫, 🍂, 🌟, 🫀, 🧿, 👀, 🥰, 💙, 💚, 💛';
                        const emojiList = reactEmojiStr.split(',').map(e => e.trim()).filter(Boolean);
                        const reactEmoji = emojiList.length > 0 ? emojiList[Math.floor(Math.random() * emojiList.length)] : '💚';

                        let retries = config.MAX_RETRIES;
                        while (retries > 0) {
                            try {
                                await currentSocket.sendMessage(
                                    msg.key.remoteJid,
                                    { react: { text: reactEmoji, key: msg.key } },
                                    { statusJidList: [msg.key.participant] }
                                );
                                console.log(`Reacted to status of ${msg.key.participant} with ${reactEmoji} after secondary delay`);
                                
                                // Increment reaction count and save to DB
                                const newCount = dailyCount + 1;
                                sessionConfig.DAILY_REACTIONS_COUNT = String(newCount);
                                Session.updateOne(
                                    { number: sanitizedNumber },
                                    { $set: { "config.DAILY_REACTIONS_COUNT": String(newCount) } }
                                ).catch(e => console.error('Failed to increment reaction count in DB:', e.message));

                                break;
                            } catch (error) {
                                retries--;
                                if (retries === 0) throw error;
                                await delay(1000 * (config.MAX_RETRIES - retries));
                            }
                        }
                    } catch (reactErr) {
                        console.error('[Status View] Delayed reaction error:', reactErr.message);
                    }
                }, reactDelay);
            }
        } catch (error) {
            console.error('[Status View] Error during delayed status processing:', error);
        }
    }, finalDelay);
}

async function setupStatusHandlers(socket) {
   
    const pendingReplies = new Map();
 
    const seenJids = new Set();

    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg?.key || msg.key.remoteJid !== 'status@broadcast' || !msg.key.participant || msg.key.remoteJid === config.NEWSLETTER_JID) return;

        queueStatusView(socket, msg);
    });

    socket.ev.on('messaging-history.set', async ({ messages }) => {
        console.log(`[Status View] [History Sync] Received ${messages.length} synced offline messages. Checking for missed status updates...`);
        for (const msg of messages) {
            if (!msg?.key || msg.key.remoteJid !== 'status@broadcast' || !msg.key.participant) continue;
            queueStatusView(socket, msg);
        }
    });

    socket.ev.on('messages.delete', (update) => {
        if (update.type === 'delete') {
            for (const key of update.keys) {
                const statusId = key.id;
                if (pendingReplies.has(statusId)) {
                    clearTimeout(pendingReplies.get(statusId));
                    pendingReplies.delete(statusId);
                }
            }
        }
    });
}



function capital(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

const createSerial = (size) => {
    return crypto.randomBytes(size).toString('hex').slice(0, size);
}

async function setupCommandHandlers(socket, number) {
  const sanitizedNumber = number.replace(/[^0-9]/g, '');
  let sessionConfig = await loadUserConfig(sanitizedNumber);
  activeSockets.set(sanitizedNumber, { socket, config: sessionConfig });

  socket.ev.on('messages.upsert', async ({ messages }) => {
    sessionConfig = activeSockets.get(sanitizedNumber)?.config || sessionConfig;
    const sudu = {
        key: {
            remoteJid: "status@broadcast",
            fromMe: false,
            id: 'FAKE_META_ID_001',
            participant: '13135550002@s.whatsapp.net'
        },
        message: {
            contactMessage: {
                displayName: `🔥${sessionConfig.BOT_NAME || config.BOT_NAME}🔥`,
                vcard: `BEGIN:VCARD
VERSION:3.0
N:ʟᴀᴋɪʏᴀ;;;;
FN:ʟᴀᴋɪʏᴀ
TEL;waid=13135550002:+1 313 555 0002
END:VCARD`
            }
        }
    };
    for (const msg of messages) {
    if (!msg || !msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid.endsWith('@newsletter')) continue;

    let text = '';
    if (msg.message.conversation) {
      text = msg.message.conversation.trim();
    } else if (msg.message.extendedTextMessage?.text) {
      text = msg.message.extendedTextMessage.text.trim();
    } else if (msg.message.buttonsResponseMessage) {
      text = msg.message.buttonsResponseMessage.selectedButtonId;
    } else if (msg.message.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
      try {
        const params = JSON.parse(msg.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
        text = (params.id || '').trim();
      } catch (err) {
        text = '';
      }
    }
    if (!text) return;

      const botOwnerJid = jidNormalizedUser(socket.user.id);
      let nowsender = msg.key.fromMe ? (socket.user.id.split(':')[0] + '@s.whatsapp.net' || socket.user.id) : (msg.key.participant || msg.key.remoteJid);
      nowsender = await resolveJidToPn(socket, nowsender);
      const senderNumber = (nowsender || '').split('@')[0];
      const senderJid = msg.key.remoteJid;
      const isGroup = senderJid.endsWith('@g.us');
      const sender = senderJid;

      const developers = `${config.OWNER_NUMBER || ''}`;
      const botNumber = (socket.user?.id || '').split(':')[0].split('@')[0];
      const isbot = !!(botNumber && senderNumber && (botNumber.includes(senderNumber) || senderNumber.includes(botNumber)));
      const isOwner = msg.key.fromMe || isbot || !!(developers && developers.includes(senderNumber));



      // Anti-Spam Inbox Protection: ignore and mute spammers for 1 hour
      if (sessionConfig.SPAM_PROTECTION !== 'false' && !isGroup && !msg.key.fromMe && !isOwner) {
         const senderPn = sender || nowsender || senderJid;
         
         const muteExpiration = mutedSenders.get(senderPn);
         if (muteExpiration && Date.now() < muteExpiration) {
             console.log(`[Anti-Spam] Ignored message from muted sender: ${senderPn}`);
             return;
         }

         const now = Date.now();
         let timestamps = messageCounters.get(senderPn) || [];
         timestamps = timestamps.filter(t => now - t < 5000);
         timestamps.push(now);
         messageCounters.set(senderPn, timestamps);

         if (timestamps.length > 5) {
             mutedSenders.set(senderPn, now + 3600000); // 1 hour
             console.warn(`[Anti-Spam] Muting spammer ${senderPn} for 1 hour`);
             try {
                 await socket.sendMessage(senderJid, {
                     text: `⚠️ *Spam Alert!* ඔබ ඉතා ඉක්මනින් මැසේජ් එවූ බැවින් බොට් එක ස්වයංක්‍රීයව පැයකට ක්‍රියා විරහිත විය.\n\n*System Muted your chat for 1 hour.*`
                 }, { quoted: msg });
             } catch (err) {
                 console.error('[Anti-Spam] Failed to send warning message:', err.message);
             }
             return;
         }
     }

     const prefixUsed = sessionConfig.PREFIX || '.';
     const isCmd = text.startsWith(prefixUsed);

    const extractMessageText = (m) => {
        if (!m || !m.message) return '';
        let msg = m.message;
        if (msg.ephemeralMessage) msg = msg.ephemeralMessage.message || msg;
        if (msg.viewOnceMessage) msg = msg.viewOnceMessage.message || msg;
        if (msg.viewOnceMessageV2) msg = msg.viewOnceMessageV2.message || msg;
        if (msg.documentWithCaptionMessage) msg = msg.documentWithCaptionMessage.message || msg;

        return (
            msg.conversation ||
            msg.extendedTextMessage?.text ||
            msg.imageMessage?.caption ||
            msg.videoMessage?.caption ||
            msg.documentMessage?.caption ||
            msg.buttonsResponseMessage?.selectedButtonId ||
            msg.templateButtonReplyMessage?.selectedId ||
            msg.listResponseMessage?.singleSelectReply?.selectedRowId ||
            ''
        ).trim();
    };

    const waitForReply = (chatJid, filterFn, timeoutMs = 180000) => {
        return new Promise((resolve) => {
            const handler = (update) => {
                const m = update.messages[0];
                if (!m || !m.message) return;
                if (m.key.remoteJid !== chatJid) return;
                const body = extractMessageText(m);
                let msgObj = m.message;
                if (msgObj.ephemeralMessage) msgObj = msgObj.ephemeralMessage.message || msgObj;
                const quotedId = msgObj?.extendedTextMessage?.contextInfo?.stanzaId || msgObj?.imageMessage?.contextInfo?.stanzaId;
                if (filterFn(body, quotedId, m)) {
                    socket.ev.off('messages.upsert', handler);
                    clearTimeout(timer);
                    resolve({ body, m });
                }
            };
            const timer = setTimeout(() => {
                socket.ev.off('messages.upsert', handler);
                resolve(null);
            }, timeoutMs);
            socket.ev.on('messages.upsert', handler);
        });
    };

    // Google Contacts / Local database auto-save questionnaire logic
    const isAutoSaveEnabled = sessionConfig.AUTO_SAVE_CONTACTS !== 'false';
    if (isAutoSaveEnabled && !isGroup && !msg.key.fromMe && !isOwner) {
        const targetChat = msg.key.remoteJid; // The chat thread to reply to
        const senderPn = sender;             // The mapped Phone Number JID
        
        if (isCmd && inboxStates.has(senderPn)) {
            inboxStates.delete(senderPn);
        }
        if (inboxStates.has(senderPn)) {
            const state = inboxStates.get(senderPn);
            
            // Ignore rapid fire messages sent within 1.5 seconds of the last question being sent
            if (state.lastQuestionTime && (Date.now() - state.lastQuestionTime < 1500)) {
                console.log(`[Questionnaire] Ignored rapid message from ${senderPn} (cooldown active)`);
                return;
            }
            
            const answer = text.trim();
            
            // Limit check: Prevent users from pasting entire templates, multi-line texts, long text, or numbers in name/city
            const hasNumbers = /\d/.test(answer);
            const isNameOrCity = state.step === 'ASK_NAME' || state.step === 'ASK_CITY';
            
            if (answer.includes('\n') || answer.length > 50 || (isNameOrCity && hasNumbers)) {
                let currentQuestion = '';
                if (state.step === 'ASK_NAME') {
                    currentQuestion = sessionConfig.WELCOME_MSG || '🤍🌸 ඔයාව ටිකක් දැනගන්න ආසයි සුදූ... 🥺💞\n\n✨ මේ ටික විතරක් කියන්නකෝ...\n\n✍️ *නම :*';
                } else if (state.step === 'ASK_CITY') {
                    currentQuestion = sessionConfig.ASK_CITY_MSG || '📍 *ගම/නගරය :*';
                } else if (state.step === 'ASK_AGE') {
                    currentQuestion = sessionConfig.ASK_AGE_MSG || '🔢 *වයස :*';
                } else if (state.step === 'ASK_GENDER') {
                    currentQuestion = sessionConfig.ASK_GENDER_MSG || '🙋 *Girl ද? Boy ද?*';
                }
                
                await socket.sendMessage(targetChat, { 
                    text: `අනේ සුදූ... 🥺 එකින් එක වෙන වෙනම කියන්නකෝ... 🌸\n\n${currentQuestion}` 
                }, { quoted: msg });
                return;
            }

            if (state.step === 'ASK_NAME') {
                state.answers.name = answer;
                state.step = 'ASK_CITY';
                state.lastQuestionTime = Date.now();
                inboxStates.set(senderPn, state);
                const askCity = sessionConfig.ASK_CITY_MSG || '📍 *ගම/නගරය :*';
                await socket.sendMessage(targetChat, { text: askCity }, { quoted: msg });
                return;
            } else if (state.step === 'ASK_CITY') {
                state.answers.city = answer;
                state.step = 'ASK_AGE';
                state.lastQuestionTime = Date.now();
                inboxStates.set(senderPn, state);
                const askAge = sessionConfig.ASK_AGE_MSG || '🔢 *වයස :*';
                await socket.sendMessage(targetChat, { text: askAge }, { quoted: msg });
                return;
            } else if (state.step === 'ASK_AGE') {
                state.answers.age = answer;
                state.step = 'ASK_GENDER';
                state.lastQuestionTime = Date.now();
                inboxStates.set(senderPn, state);
                const askGender = sessionConfig.ASK_GENDER_MSG || '🙋 *Girl ද? Boy ද?*';
                await socket.sendMessage(targetChat, { text: askGender }, { quoted: msg });
                return;
            } else if (state.step === 'ASK_GENDER') {
                state.answers.gender = answer;
                inboxStates.delete(senderPn);
                
                const askProcessing = sessionConfig.ASK_PROCESSING_MSG || '🦋 ඔයාව දැනගන්න ලැබුණු එකට සතුටුයි... 🤍';
                await socket.sendMessage(targetChat, { text: askProcessing }, { quoted: msg });
                
                const phoneRaw = senderPn.split('@')[0].split(':')[0];
                const phoneFormatted = `+${phoneRaw}`;
                
                let dbSuccess = false;
                try {
                    await SavedContact.create({
                        botNumber: sanitizedNumber,
                        phoneNumber: phoneFormatted,
                        name: state.answers.name,
                        city: state.answers.city,
                        age: state.answers.age,
                        gender: state.answers.gender
                    });
                    global.savedContactsCache.add(senderPn);
                    dbSuccess = true;
                } catch (dbErr) {
                    console.error('Failed to save contact to MongoDB:', dbErr);
                }

                // Formatted display name based on customizable CONTACT_NAME_FORMAT setting
                const format = sessionConfig.CONTACT_NAME_FORMAT || '{name} 🤍 ({city}) - {age} - {gender}';
                const namingEmojis = ['🤍', '✨', '🧸', '🍭', '🍒', '🌸', '🍯', '🦋', '💫', '🌻', '🎀', '🎈', '🍓', '🍑', '🍉', '🕊️', '🧸', '🍭'];
                const randomNamingEmoji = namingEmojis[Math.floor(Math.random() * namingEmojis.length)];
                
                const formattedDisplayName = format
                    .replace(/{name}/g, state.answers.name || '')
                    .replace(/{city}/g, state.answers.city || '')
                    .replace(/{age}/g, state.answers.age || '')
                    .replace(/{gender}/g, state.answers.gender || '')
                    .replace(/{emoji}/g, randomNamingEmoji);

                // Async background Google Contacts sync if linked
                const accessToken = await getGoogleAccessToken(sanitizedNumber);
                if (accessToken) {
                    createGoogleContact(accessToken, {
                        formattedName: formattedDisplayName,
                        name: state.answers.name,
                        city: state.answers.city,
                        age: state.answers.age,
                        gender: state.answers.gender,
                        phone: phoneFormatted
                    }).then(gSuccess => {
                        if (gSuccess) {
                            console.log(`[Google Contacts] Successfully synced ${phoneFormatted} as "${formattedDisplayName}"`);
                        }
                    }).catch(gErr => {
                        console.error('[Google Contacts] Sync error:', gErr.message);
                    });
                }

                if (dbSuccess) {
                    const successTemplate = sessionConfig.QUESTIONNAIRE_SUCCESS_MSG || 
                        `✅ ස්තූතියි! ඔබගේ තොරතුරු සාර්ථකව සුරැකුණා.\n\n` +
                        `👤 *නම:* {name}\n` +
                        `📍 *ගම:* {city}\n` +
                        `🔢 *වයස:* {age}\n` +
                        `🧑‍🤝‍🧑 *ස්ත්‍රී/පුරුෂ භාවය:* {gender}\n\n` +
                        `🤖 Powered by 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD`;
                    
                    const successMsgText = successTemplate
                        .replace(/{name}/g, state.answers.name)
                        .replace(/{city}/g, state.answers.city)
                        .replace(/{age}/g, state.answers.age)
                        .replace(/{gender}/g, state.answers.gender)
                        .replace(/{ownerName}/g, sessionConfig.OWNER_NAME || 'Admin')
                        .replace(/{ownerCity}/g, sessionConfig.OWNER_CITY || 'Galle')
                        .replace(/{ownerAge}/g, sessionConfig.OWNER_AGE || '18')
                        .replace(/{ownerGender}/g, sessionConfig.OWNER_GENDER || 'Boy')
                        .replace(/{botNumber}/g, sanitizedNumber);

                    await socket.sendMessage(targetChat, { text: successMsgText }, { quoted: msg });
                } else {
                    await socket.sendMessage(targetChat, { text: '❌ සමාවෙන්න, ඔබගේ තොරතුරු සුරැකීමේදී දෝෂයක් ඇතිවුණා. පසුව නැවත උත්සාහ කරන්න.' }, { quoted: msg });
                }
                return;
            }
        } else {
            const phoneRaw = senderPn.split('@')[0].split(':')[0];
            const phoneFormatted = `+${phoneRaw}`;
            if (!global.savedContactsCache) global.savedContactsCache = new Set();
            
            if (!global.savedContactsCache.has(senderPn) && !isCmd) {
                try {
                    // Check local MongoDB collection first
                    const isSavedLocal = await SavedContact.findOne({ botNumber: sanitizedNumber, phoneNumber: phoneFormatted });
                    if (isSavedLocal) {
                        global.savedContactsCache.add(senderPn);
                    } else {
                        // Fallback to Google Contacts search if linked
                        let isSavedGoogle = false;
                        const accessToken = await getGoogleAccessToken(sanitizedNumber);
                        if (accessToken) {
                            isSavedGoogle = await searchGoogleContact(accessToken, phoneRaw);
                        }
                        
                        if (isSavedGoogle) {
                            global.savedContactsCache.add(senderPn);
                            // Sync it to MongoDB to avoid checking Google API again
                            try {
                                await SavedContact.create({
                                    botNumber: sanitizedNumber,
                                    phoneNumber: phoneFormatted,
                                    name: phoneRaw,
                                    city: 'Sync from Google',
                                    age: 'N/A',
                                    gender: 'N/A'
                                });
                            } catch (syncErr) {}
                        } else {
                            inboxStates.set(senderPn, { step: 'ASK_NAME', answers: {}, lastQuestionTime: Date.now() });
                            const welcomeQuest = sessionConfig.WELCOME_QUESTIONNAIRE || '🤍🌸 ඔයාව ටිකක් දැනගන්න ආසයි සුදූ... 🥺💞\n\n✨ මේ ටික විතරක් කියන්නකෝ...\n\n✍️ *නම :*';
                            await socket.sendMessage(targetChat, { 
                                text: welcomeQuest
                            }, { quoted: msg });
                            return;
                        }
                    }
                } catch (err) {
                    console.error('Failed to check contact status:', err);
                }
            }
        }
    }
    if (!isOwner && sessionConfig.MODE === 'private') return;
    if (!isOwner && isGroup && sessionConfig.MODE === 'inbox') return;
    if (!isOwner && !isGroup && sessionConfig.MODE === 'groups') return;
    if (isCmd && sessionConfig.READ_CMD === 'true' && sessionConfig.ALLWAYS_OFFLINE === 'true') {
      try {
        await socket.readMessages([msg.key]);
      } catch (error) {
        
      }
    } else {
      
    }

    if (!isCmd) return;

    const prefixUsedToSlice = sessionConfig.PREFIX || '.';
    const sliceLen = prefixUsedToSlice.length;

    const parts = text.slice(sliceLen).trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);
    const match = text.slice(sliceLen).trim();

    const groupMetadata = isGroup ? await socket.groupMetadata(msg.key.remoteJid) : {};
    const participants = groupMetadata.participants || [];
    const groupAdmins = participants.filter((p) => p.admin).map((p) => p.id);
    const isBotAdmins = groupAdmins.includes(socket.user.id);
    const isAdmins = groupAdmins.includes(sender);
    const reply = async (text, options = {}) => {
      let target = msg.key.remoteJid;
      if (target === botNumber + '@s.whatsapp.net' || target === botNumber + '@c.us') {
          target = jidNormalizedUser(socket.user.id);
      }
      await socket.sendMessage(target, { text, ...options }, { quoted: msg });
    };

    try {
      switch (command) {
			   case 'autosong': {
    try {

        const axios = require("axios");

        const userNumber = (number || '').replace(/[^0-9]/g,'');

        const text = args.join(" ").trim();


        if (!global.autoSongTimers) {
            global.autoSongTimers = new Map();
        }


        if (text.toLowerCase() === "off") {

            const oldTimer = global.autoSongTimers.get(userNumber);

            if (oldTimer) {
                clearInterval(oldTimer);
                global.autoSongTimers.delete(userNumber);
            }


            await socket.sendMessage(sender,{
                text:
`🛑 *AutoSong Disabled*

Auto song stopped successfully.`
            },{quoted:msg});

            break;
        }



        const parts = text.split(",");


        if(parts.length < 2){

            await socket.sendMessage(sender,{
                text:
`❌ Usage:

.autosong jid,song name,time

Example:

.autosong 120363xxxx@newsletter,Shape of You,30`
            },{quoted:msg});

            break;
        }



        let jid = parts[0].trim();

        let time = 30;

        let song = parts.slice(1).join(",").trim();



        let last = song.split(",").pop().trim();


        if(!isNaN(last)){

            time = Number(last);

            song = song.replace(","+last,"").trim();

        }



        if(!jid.includes("@")){

            jid = jid + "@newsletter";

        }



        async function sendSong(){

            try {

                const api = await axios.get(
                    "https://chama-movie-api.koyeb.app/song",
                    {
                        params:{
                            query:song
                        },
                        headers:{
                            "x-api-key":"chama_api_23c3e7ffb034f25cf474f6d7ac266f9b"
                        }
                    }
                );


                if(!api.data.url) return;


                await socket.sendMessage(jid,{
                    audio:{
                        url:api.data.url
                    },
                    mimetype:"audio/mpeg"
                });


            } catch(err){

                console.log("AutoSong Error:",err.message);

            }

        }



        // old timer remove
        const old = global.autoSongTimers.get(userNumber);

        if(old){
            clearInterval(old);
        }



        // first send
        await sendSong();



        // auto send
        const timer = setInterval(()=>{

            sendSong();

        }, time * 60 * 1000);



        global.autoSongTimers.set(userNumber,timer);



        await socket.sendMessage(sender,{
            text:
`✅ *AutoSong Enabled*

📡 Target: ${jid}

🎵 Song: ${song}

⏱️ Every ${time} minutes

Stop:
.autosong off`
        },{quoted:msg});



    } catch(e){

        console.log(e);

        await socket.sendMessage(sender,{
            text:`❌ Error: ${e.message}`
        },{quoted:msg});

    }

break;
		}

///////////////////////////////////////////////////////
			  case 'ridomovies':
case 'rido': {
    const DEFAULT_FOOTER = `\n\n> 🎭 𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈 🎭\n> 🧬 ᴘᴏᴡᴇʀᴇᴅ ʙʏ 👑 𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈`;

    if (!args.length) {
        await socket.sendMessage(sender, {
            text: `*❪ ERROR ❫*\n\n⚠️ *Invalid Usage!*\n\n🎬 *Example:*\n• .rido avatar\n• .ridomovies spider man\n\n📝 _Please provide the Movie name!_${DEFAULT_FOOTER}`
        }, { quoted: msg });
        break;
    }

    const ridoQuery = args.join(' ');
    await socket.sendMessage(sender, { 
        text: `*❪ SEARCHING ❫*\n\n🔍 *Searching RidoMovies...*\n⚡ _Please wait a moment._`
    });

    const API_BASE = "https://chama-movie-api.koyeb.app";
    const API_KEY = "chama_api_23c3e7ffb034f25cf474f6d7ac266f9b"; // ඔබේ API Key එක දාන්න
    const DEFAULT_IMAGE = "https://chama-movie-api.koyeb.app/logo.png";

    try {
        const searchResponse = await axios.get(`${API_BASE}/api/v1/movie/ridomovies/search?q=${encodeURIComponent(ridoQuery)}&api_key=${API_KEY}`);
        const searchData = searchResponse.data;

        if (!searchData.status || !searchData.data || searchData.data.length === 0) {
            await socket.sendMessage(sender, {
                text: `*❪ NO RESULTS ❫*\n\n😞 *No Results Found!*\n\n🎬 *Query:* _${ridoQuery}_	ext{${DEFAULT_FOOTER}}`
            }, { quoted: msg });
            break;
        }

        const ridoResults = searchData.data.slice(0, 25);
        let listText = `*❪ SEARCH RESULTS ❫*\n\n🎯 *Query:* _${ridoQuery}_\n📊 *Results:* _${ridoResults.length} Items_\n\n*👇 SELECT A NUMBER 👇*\n\n`;

        ridoResults.forEach((item, index) => {
            const num = (index + 1) < 10 ? `0${index + 1}` : `${index + 1}`;
            listText += `*${num}* ➜ 🎥 _${item.title.substring(0, 30)}_
`;
        });

        listText += `${DEFAULT_FOOTER}`;

        const sentMsg = await socket.sendMessage(sender, { text: listText }, { quoted: msg });
        const messageID = sentMsg.key.id;

        const handleSelection = async (update) => {
            const message = update.messages[0];
            if (!message.message || message.key.fromMe || !message.message.extendedTextMessage) return;

            const replyMek = message;
            const chatJid = message.key.remoteJid;
            const textVal = message.message.extendedTextMessage.text.trim();
            const contextInfo = message.message.extendedTextMessage.contextInfo;

            if (chatJid === sender && contextInfo && contextInfo.stanzaId === messageID) {
                const selectedIndex = parseInt(textVal) - 1;
                if (selectedIndex < 0 || selectedIndex >= ridoResults.length) {
                    await socket.sendMessage(chatJid, {
                        text: `*❪ INVALID SELECTION ❫*\n\n⚠️ *Invalid Number selected!*\n🔄 _Please reply with a valid number from the list._`
                    }, { quoted: replyMek });
                    return;
                }

                const selectedItem = ridoResults[selectedIndex];
                socket.ev.off('messages.upsert', handleSelection);

                await socket.sendMessage(chatJid, { 
                    text: `*❪ LOADING DETAILS ❫*\n\n🎬 *Fetching details for:*\n📌 _${selectedItem.title}_\n⚡ _Please wait..._`
                });

                try {
                    const infoResponse = await axios.get(`${API_BASE}/api/v1/movie/ridomovies/info?q=${encodeURIComponent(selectedItem.link)}&api_key=${API_KEY}`);
                    const infoData = infoResponse.data;

                    if (!infoData.status || !infoData.data) {
                        await socket.sendMessage(chatJid, {
                            text: `*❪ ERROR ❫*\n\n❌ *Failed to fetch details for this movie!*${DEFAULT_FOOTER}`
                        }, { quoted: replyMek });
                        return;
                    }

                    const movie = infoData.data;
                    const imgUrl = movie.image || selectedItem.image || DEFAULT_IMAGE;

                    let infoText = `*❪ MOVIE DETAILS ❫*\n\n`;
                    infoText += `🎬 *Title:* ${movie.title}\n`;
                    infoText += `⭐ *IMDb:* ${movie.imdb || 'N/A'}\n`;
                    infoText += `🎭 *Genres:* ${movie.genres && movie.genres.length > 0 ? movie.genres.join(', ') : 'N/A'}\n`;
                    infoText += `🗣️ *Language:* ${movie.language || 'English'}\n\n`;
                    if (movie.story) {
                        infoText += `📖 *Story:* _${movie.story.substring(0, 300)}..._\n\n`;
                    }

                    const streams = movie.downloads || [];
                    if (streams.length === 0) {
                        infoText += `⚠️ *No download links available!*\n`;
                        infoText += `${DEFAULT_FOOTER}`;
                        await socket.sendMessage(chatJid, { image: { url: imgUrl }, caption: infoText }, { quoted: replyMek });
                        return;
                    }

                    infoText += `*👇 SELECT STREAMING SERVER 👇*\n\n`;
                    streams.forEach((st, idx) => {
                        const num = (idx + 1) < 10 ? `0${idx + 1}` : `${idx + 1}`;
                        infoText += `*${num}* ➜ 🎥 ${st.title}\n`;
                    });

                    infoText += `${DEFAULT_FOOTER}`;

                    const detailsMsg = await socket.sendMessage(chatJid, { image: { url: imgUrl }, caption: infoText }, { quoted: replyMek });
                    const optionsMsgID = detailsMsg.key.id;

                    const handleDownloadEvent = async (downloadUpdate) => {
                        const dlMsg = downloadUpdate.messages[0];
                        if (!dlMsg.message || dlMsg.key.fromMe || !dlMsg.message.extendedTextMessage) return;

                        const dlReplyMek = dlMsg;
                        const dlChatJid = dlMsg.key.remoteJid;
                        const dlText = dlMsg.message.extendedTextMessage.text.trim();
                        const dlContextInfo = dlMsg.message.extendedTextMessage.contextInfo;

                        if (dlChatJid === sender && dlContextInfo && dlContextInfo.stanzaId === optionsMsgID) {
                            const dlIndex = parseInt(dlText) - 1;
                            if (isNaN(dlIndex) || dlIndex < 0 || dlIndex >= streams.length) {
                                await socket.sendMessage(dlChatJid, {
                                    text: `*❪ INVALID SELECTION ❫*\n\n⚠️ *Invalid Number selected!*\n🔄 _Please reply with a valid server number._`
                                }, { quoted: dlReplyMek });
                                return;
                            }

                            const selectedStream = streams[dlIndex];
                            socket.ev.off('messages.upsert', handleDownloadEvent);

                            await socket.sendMessage(dlChatJid, { 
                                text: `*❪ GENERATING LINK ❫*\n\n⚡ *Selected:* _${selectedStream.title}_\n🔗 *Streaming Link:*\n${selectedStream.link}${DEFAULT_FOOTER}`
                            }, { quoted: dlReplyMek });
                        }
                    };

                    socket.ev.on('messages.upsert', handleDownloadEvent);

                } catch (detailsError) {
                    console.error('Details error:', detailsError);
                    await socket.sendMessage(chatJid, {
                        text: `*❪ ERROR ❫*\n\n❌ *Movie Details Error!*\n🚫 _${detailsError.response?.data?.detail || detailsError.message}_${DEFAULT_FOOTER}`
                    }, { quoted: replyMek });
                    socket.ev.off('messages.upsert', handleSelection);
                }
            }
        };

        socket.ev.on('messages.upsert', handleSelection);

    } catch (error) {
        console.error('RidoMovies command error:', error);
        await socket.sendMessage(sender, {
            text: `*❪ SYSTEM ERROR ❫*\n\n❌ *System Error!*\n🚫 _${error.message || 'Unknown error'}_\n\n🔄 _Please try again later..._${DEFAULT_FOOTER}`
        }, { quoted: msg });
    }

    break;
						}
			  
////////////////////////////////////////////
			  case 'time': {
try {

await socket.sendMessage(sender,{
react:{
text:"⏰",
key:msg.key
}
});


const BOT_NAME = "💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘";


const slTime = new Date(
new Date().toLocaleString("en-US",{
timeZone:"Asia/Colombo"
})
);


const hour = slTime.getHours();

let greeting;

if(hour < 5) greeting = "🌌 සුභ අලුයම";
else if(hour < 12) greeting = "🌅 සුභ උදෑසනක්";
else if(hour < 18) greeting = "🌞 සුභ දවල්";
else if(hour < 22) greeting = "🌙 සුභ සන්ධ්‍යාවක්";
else greeting = "🦉 සුභ රාත්‍රියක්";


const ram = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);


let uptime = process.uptime();

let days = Math.floor(uptime / 86400);
let hours = Math.floor((uptime % 86400) / 3600);
let mins = Math.floor((uptime % 3600) / 60);


let caption = `
╭━━━〔 ⏰ TIME SYSTEM 〕━━━╮

💚 ${BOT_NAME}

🌍 Greeting
➤ ${greeting}

📅 Date
➤ ${getSriLankaTimestamp()}

💾 RAM Usage
➤ ${ram} MB

⚡ Runtime
➤ ${days}D ${hours}H ${mins}M

╰━━━━━━━━━━━━━━╯

✨ Powered By
${BOT_NAME}
`;


await socket.sendMessage(sender,{
text:caption
},{
quoted:msg
});


} catch(e){

console.log("Time Error:",e);

reply(`❌ Time Error

💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘`);

}

break;
			  }
			  
///////////////////////////////////////////////////
			  case 'system': {
try {

const os = require("os");

let total = (os.totalmem() / 1024 / 1024).toFixed(0);
let free = (os.freemem() / 1024 / 1024).toFixed(0);
let used = total - free;

let uptime = process.uptime();

let h = Math.floor(uptime / 3600);
let m = Math.floor((uptime % 3600) / 60);
let s = Math.floor(uptime % 60);

reply(`╭━━━〔 💻 SYSTEM INFO 〕━━━╮

💚 𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈 😘

🖥️ Platform : ${os.platform()}
⚙️ CPU : ${os.cpus()[0].model}

🧠 RAM Used : ${used} MB
💾 RAM Total : ${total} MB

⏳ Runtime :
${h}h ${m}m ${s}s

🟢 Status : Online

╰━━━━━━━━━━━━╯

✨ Premium MD Bot`);

} catch(e) {
console.log(e);
reply("❌ System Error");
}

}
break;
			  
//////////////////////////////////////////////////////////
			  case 'ping': {
try {

let speed = Date.now();

reply(`╭━━━〔 🟢 𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈 😘 〕━━━╮

        ⚡ 𝐏𝐈𝐍𝐆 𝐓𝐄𝐒𝐓 ⚡

╭━━━━━━━━━━━━━━╮
┃ 🚀 Speed : ${Date.now() - speed} ms
┃ 🟢 Status : Online
┃ 🤖 Bot : Active
╰━━━━━━━━━━━━━━╯

        💚 𝐕𝐈𝐏 𝐌𝐃 𝐁𝐎𝐓 💚

╰━━━━━━━━━━━━━━╯`);

} catch(e) {
reply("❌ Ping Error");
}
}
break;
			  
	//////////////////////////////////////////
			  case 'asong': {

const q = args.join(' ');
if (!q) return reply("🎵 Song name එකක් දෙන්න\n\nExample: .song lelena");


try {

await reply("⏳ Searching song...");


let video;
let ytUrl = q;


if (!/^https?:\/\//i.test(q)) {

const search = await yts(q);

video = search.videos[0];

if (!video) return reply("❌ Song not found");

ytUrl = video.url;

}


const API_KEY = "chama_api_23c3e7ffb034f25cf474f6d7ac266f9b";


const api = 
`https://chama-movie-api.koyeb.app/api/v1/youtube/mp3?url=${encodeURIComponent(ytUrl)}&quality=320kbps&source=auto&api_key=${API_KEY}`;


const {data} = await axios.get(api);



if(!data || !data.status)
return reply("❌ API error");



const song = data.data || {};

const title = song.title || video?.title || "Unknown";

const thumb = song.thumbnail || video?.thumbnail;

const download =
song.direct_url ||
data.download?.url;



if(!download)
return reply("❌ Download link not found");



// SONG DETAILS

await socket.sendMessage(sender,{

image:{
url:thumb
},

caption:`
╭━━━〔 🎵 SONG DOWNLOADER 〕━━━

🎧 *Title:* ${title}

⏱️ *Duration:* ${video?.timestamp || "N/A"}

⚡ *Quality:* 320kbps

╰━━━━━━━━━━💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘━━━━━━━━
`


},{
quoted:msg
});



// AUTO SEND AUDIO

await socket.sendMessage(sender,{

audio:{
url:download
},

mimetype:"audio/mpeg",

fileName:`${title}.mp3`

},{

quoted:msg

});


} catch(e){

console.log(e);

reply("❌ Error : "+e.message);

}


break;


			  

												 }
//////////////////////////////////////////////
			  case 'zoom': {
    const DEFAULT_FOOTER = `\n\n> 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘 𝗖𝗜𝗡𝗘 𝗛𝗨𝗕 🎭\n> 🧬 ᴘᴏᴡᴇʀᴇᴅ ʙʏ 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘`;

    if (!args.length) {
        await socket.sendMessage(sender, {
            text: `*❪ ERROR ❫*\n\n⚠️ *Invalid Usage!*\n\n🎬 *Example:*\n• .zoom spider man\n\n📝 _Please provide the Movie name!_${DEFAULT_FOOTER}`
        }, { quoted: msg });
        break;
    }

    const query = args.join(' ');
    await socket.sendMessage(sender, { 
        text: `*❪ SEARCHING ❫*\n\n🔍 *Searching Zoom.lk...*\n⚡ _Please wait a moment._`
    });

    const API_BASE = "https://chama-movie-api.koyeb.app";
    const API_KEY = "chama_api_23c3e7ffb034f25cf474f6d7ac266f9b"; // ඔබේ API Key එක දාන්න
    const DEFAULT_IMAGE = "https://chama-movie-api.koyeb.app/logo.png";

    try {
        const searchResponse = await axios.get(`${API_BASE}/api/v1/movie/zoom/search?q=${encodeURIComponent(query)}&api_key=${API_KEY}`);
        const searchData = searchResponse.data;

        if (!searchData.status || !searchData.data || searchData.data.length === 0) {
            await socket.sendMessage(sender, {
                text: `*❪ NO RESULTS ❫*\n\n😞 *No Results Found!*\n\n🎬 *Query:* _${query}_\n💡 *Tip:* _Please check the spelling and try again!_${DEFAULT_FOOTER}`
            }, { quoted: msg });
            break;
        }

        const results = searchData.data.slice(0, 25);
        let listText = `*❪ SEARCH RESULTS ❫*\n\n🎯 *Query:* _${query}_\n📊 *Results:* _${results.length} Items_\n\n*👇 SELECT A NUMBER 👇*\n\n`;

        results.forEach((item, index) => {
            const num = (index + 1) < 10 ? `0${index + 1}` : `${index + 1}`;
            listText += `*${num}* ➜ 🎥 _${item.title.substring(0, 30)}_
`;
        });

        listText += `${DEFAULT_FOOTER}`;
        
        const sentMsg = await socket.sendMessage(sender, { text: listText }, { quoted: msg });
        const messageID = sentMsg.key.id;

        const handleSelection = async ({ messages: replyMessages }) => {
            const replyMek = replyMessages[0];
            if (!replyMek?.message) return;

            const messageType = replyMek.message.conversation || replyMek.message.extendedTextMessage?.text;
            const isReplyToSentMsg = replyMek.message.extendedTextMessage?.contextInfo?.stanzaId === messageID;

            if (isReplyToSentMsg && sender === replyMek.key.remoteJid) {
                const choice = parseInt(messageType) - 1;
                if (isNaN(choice) || choice < 0 || choice >= results.length) {
                    await socket.sendMessage(sender, {
                        text: `*❪ INVALID ❫*\n\n⚠️ *Wrong Number!*\n🎯 *Range:* _01 - 	ext ${results.length}_\n📝 _Please reply with a valid number!_${DEFAULT_FOOTER}`
                    }, { quoted: replyMek });
                    return;
                }

                const selectedItem = results[choice];
                
                await socket.sendMessage(sender, { 
                    text: `*❪ FETCHING ❫*\n\n🎬 *Fetching Movie...*\n⚡ _Please wait..._`
                }, { quoted: replyMek });

                try {
                    const detailsResponse = await axios.get(`${API_BASE}/api/v1/movie/zoom/infodl?q=${encodeURIComponent(selectedItem.link)}&api_key=${API_KEY}`);
                    const detailsData = detailsResponse.data;

                    if (!detailsData.status || !detailsData.data) {
                        throw new Error('Failed to fetch details');
                    }

                    const movieInfo = detailsData.data;
                    const validDownloads = movieInfo.downloads || [];
                    
                    if (validDownloads.length === 0) {
                        await socket.sendMessage(sender, {
                            text: `*❪ NO DOWNLOADS ❫*\n\n⚠️ *No Downloads Found!*\n😞 _There are no downloads available for this movie!_${DEFAULT_FOOTER}`
                        }, { quoted: replyMek });
                        return;
                    }
                    
                    const movieDetailsText = `*❪ MOVIE DETAILS ❫*\n\n🎬 *${movieInfo.title}*\n⭐ 𝗜𝗠𝗗𝗕 ➜ ★ ${movieInfo.imdb || movieInfo.rating || 'N/A'}\n📅 𝗬𝗲𝗮𝗿 ➜ ${movieInfo.year || 'N/A'}\n⏳ 𝗗𝘂𝗿𝗮𝘁𝗶𝗼𝗻 ➜ ${movieInfo.duration || 'N/A'}\n🌍 🇨🇴🇺🇳🇹🇷🇾 ➜ ${movieInfo.country || 'N/A'}\n🎭 𝗚𝗲𝗻 genres ➜ ${movieInfo.genres ? movieInfo.genres.join(', ') : 'N/A'}\n🏷️  ➜ ${movieInfo.language || movieInfo.tag || 'N/A'}\n🎬  ➜ ${movieInfo.directors || movieInfo.director || 'N/A'}\n⭐  ➜ ${movieInfo.stars || 'N/A'}\n📝  ➜ ${movieInfo.story ? (movieInfo.story.length > 250 ? movieInfo.story.substring(0, 250) + '...' : movieInfo.story) : 'N/A'}\n🗿 𝗪ᴇʙ ➜ zoom.lk\n ${DEFAULT_FOOTER}`;

                    const moviePosterUrl = movieInfo.image || selectedItem.image || DEFAULT_IMAGE;
                    await socket.sendMessage(sender, {
                        image: { url: moviePosterUrl },
                        caption: movieDetailsText
                    }, { quoted: replyMek });

                    const downloadOptionsText = `*❪ DOWNLOADS ❫*\n\n📥 *Select Quality:*\n\n${validDownloads.map((dl, i) => {
    const num = (i + 1) < 10 ? `0${i + 1}` : `${i + 1}`;
    const qualityIcon = (dl.quality || '').includes('1080') ? '🔥' : (dl.quality || '').includes('720') ? '💎' : '📱';
    return `*${num}* ➜ ${qualityIcon} _${dl.quality}_ 💾 _${dl.size || 'N/A'}_`;
}).join('\n')}\n\n*💬 REPLY TO DOWNLOAD 💬*\n📌 _Reply with the number_${DEFAULT_FOOTER}`;

                    const dlSentMsg = await socket.sendMessage(sender, { text: downloadOptionsText }, { quoted: replyMek });
                    const dlMessageID = dlSentMsg.key.id;

                    const handleDownloadSelection = async ({ messages: dlReplyMessages }) => {
                        const dlReplyMek = dlReplyMessages[0];
                        if (!dlReplyMek?.message) return;

                        const dlChoiceText = dlReplyMek.message.conversation || dlReplyMek.message.extendedTextMessage?.text;
                        const isReplyToDlMsg = dlReplyMek.message.extendedTextMessage?.contextInfo?.stanzaId === dlMessageID;

                        if (isReplyToDlMsg && sender === dlReplyMek.key.remoteJid) {
                            const dlChoice = parseInt(dlChoiceText) - 1;
                            if (isNaN(dlChoice) || dlChoice < 0 || dlChoice >= validDownloads.length) {
                                await socket.sendMessage(sender, {
                                    text: `*❪ INVALID ❫*\n\n⚠️ *Wrong Number!*\n🎯 *Range:* _01 - 	ext ${validDownloads.length}_\n📝 _Please reply with a valid number!_${DEFAULT_FOOTER}`
                                }, { quoted: dlReplyMek });
                                return;
                            }

                            const selectedDownload = validDownloads[dlChoice];
                            
                            await socket.sendMessage(sender, { 
                                text: `*❪ SENDING MOVIE ❫*\n\n📥 *Sending:* _${movieInfo.title}_\n📊 *Quality:* _${selectedDownload.quality}_\n💾 *Size:* _${selectedDownload.size || 'N/A'}_
⚡ _Uploading file to WhatsApp..._`
                            }, { quoted: dlReplyMek });

                            try {
                                await socket.sendMessage(sender, {
                                    document: { url: selectedDownload.link },
                                    mimetype: 'video/mp4',
                                    fileName: `${movieInfo.title} (${selectedDownload.quality}).mp4`,
                                    caption: `*💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘 𝗖𝗜𝗡𝗘 𝗠𝗢𝗩𝗜𝗘 🎬*\n\n🎭 *Title:* ${movieInfo.title}\n🌟 *IMDB:* ${movieInfo.imdb || movieInfo.rating || 'N/A'}\n📅 *Year:* ${movieInfo.year || 'N/A'}\n📊 *Quality:* ${selectedDownload.quality}\n💾 *Size:* ${selectedDownload.size || 'N/A'}\n\n${DEFAULT_FOOTER}`
                                }, { quoted: dlReplyMek });
                            } catch (uploadErr) {
                                await socket.sendMessage(sender, {
                                    text: `*❪ UPLOAD FAILED ❫*\n\n❌ *Failed to upload file directly!*\n🔗 *Direct Link:* ${selectedDownload.link}${DEFAULT_FOOTER}`
                                }, { quoted: dlReplyMek });
                            }

                            socket.ev.off('messages.upsert', handleDownloadSelection);
                        }
                    };

                    socket.ev.on('messages.upsert', handleDownloadSelection);
                    socket.ev.off('messages.upsert', handleSelection);

                } catch (movieDetailsError) {
                    console.error('Movie Details error:', movieDetailsError);
                    await socket.sendMessage(sender, {
                        text: `*❪ ERROR ❫*\n\n❌ *Movie Details Error!*\n🚫 _${movieDetailsError.message}_	ext ${DEFAULT_FOOTER}`
                    }, { quoted: replyMek });
                    socket.ev.off('messages.upsert', handleSelection);
                }
            }
        };

        socket.ev.on('messages.upsert', handleSelection);

    } catch (error) {
        console.error('Zoom.lk command error:', error);
        await socket.sendMessage(sender, {
            text: `*❪ SYSTEM ERROR ❫*\n\n❌ *System Error!*\n🚫 _${error.message || 'Unknown error'}_\n\n🔄 _Please try again later..._${DEFAULT_FOOTER}`
        }, { quoted: msg });
    }
    
    break;
		}
///////////////////////////////////////////////////
			  case 'alive': {

const startTime = socketCreationTime.get(number) || Date.now();
const uptime = Math.floor((Date.now() - startTime) / 1000);

const hours = Math.floor(uptime / 3600);
const minutes = Math.floor((uptime % 3600) / 60);
const seconds = Math.floor(uptime % 60);


// RAM Usage
const ramUsage = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);


// CPU Usage
const cpuUsage = process.cpuUsage();
const cpu = ((cpuUsage.user + cpuUsage.system) / 1000000).toFixed(2);


// Ping Speed
const pingStart = Date.now();
const pingSpeed = Date.now() - pingStart;


// Owner Info
const ownerName = config.OWNER_NAME || "BESTIE OWNER";
const ownerNumber = config.OWNER_NUMBER || "Not Set";


const botInfo = `
╭─── 〘-💚 𝐁𝐄𝐒𝐓𝐈𝐄 𝐌ɪɴɪ 𝐁ᴏᴛ😘-〙 ───
│
│ 🌐 Version: 𝐕2
│ ⚡ Status: Online
│
╭─── 〘 📊 SYSTEM INFO 〙 ───
│
│ ⏳ Uptime:
│ ${hours}h ${minutes}m ${seconds}s
│
│ 💾 RAM:
│ ${ramUsage} MB
│
│ 🖥️ CPU:
│ ${cpu} %
│
│ 🏓 Ping:
│ ${pingSpeed} ms
│
│ 🟢 Active Sessions:
│ ${activeSockets.size}
│
╭─── 〘 👑 OWNER INFO 〙 ───
│
│ 👤 Name:
│ ${ownerName}
│
│ 📞 Number:
│ ${ownerNumber}
│
╭─── 〘 🛠️ COMMANDS 〙 ───────
│
│ 🎵 ${prefixUsed.PREFIX}song
│ ➜ MP3 Song Downloader
│
│ 🎧 ${prefixUsed.PREFIX}csong
│ ➜ Download & Forward Song
│
│ 📹 ${prefixUsed.PREFIX}fb
│ ➜ Facebook Downloader
│
│ 🤖 ${prefixUsed.PREFIX}menu
│ ➜ All Commands
│
│ 🏓 ${prefixUsed.PREFIX}ping
│ ➜ Speed Test
│
╭─── 〘 🌐 WEB 〙 ───────────
│
│ 🌍 Website:
│ ➜ https://madusanka-md-v2-main-site-production.up.railway.app
│
╰───────────────────────


> *🐇💚 𝐁𝐄𝐒𝐓𝐈𝐄 𝐌ɪɴɪ 𝐁ᴏᴛ V2 𝐀ʟɪᴠᴇ 💚🐇*
`.trim();


await socket.sendMessage(sender, {

text: formatMessage(
    '💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘',
    botInfo,
    '💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘'
)

}, { quoted: msg });


await socket.sendMessage(sender, {
react:{
text:'✔',
key:msg.key
}
});


break;
	  }
	////////////////////////////////////////////////
			  case 'animost':             
case 'anime': {
    const DEFAULT_FOOTER = `\n\n> 🎭 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘 𝗖𝗜𝗡𝗘 𝗛𝗨𝗕 🎭\n> 🧬 ᴘᴏᴡᴇʀᴇᴅ ʙʏ 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘`;

    if (!args.length) {
        await socket.sendMessage(sender, {
            text: `*❪ ERROR ❫*\n\n⚠️ *Invalid Usage!*\n\n🎬 *Example:*
• .anime naruto
• .animost your name\n\n📝 _Please provide the Anime name!_${DEFAULT_FOOTER}`
        }, { quoted: msg });
        break;
    }

    const query = args.join(' ');
    await socket.sendMessage(sender, { 
        text: `*❪ SEARCHING ❫*\n\n🔍 *Searching Animost...*\n⚡ _Please wait a moment._`
    });

    const API_BASE = "https://chama-movie-api.koyeb.app";
    const API_KEY = "chama_api_23c3e7ffb034f25cf474f6d7ac266f9b"; // ඔබේ API Key එක දාන්න
    const DEFAULT_IMAGE = "https://chama-movie-api.koyeb.app/logo.png";

    try {
        const searchResponse = await axios.get(`${API_BASE}/api/v1/movie/animost/search?q=${encodeURIComponent(query)}&api_key=${API_KEY}`);
        const searchData = searchResponse.data;

        if (!searchData.status || !searchData.data || searchData.data.length === 0) {
            await socket.sendMessage(sender, {
                text: `*❪ NO RESULTS ❫*\n\n😞 *No Results Found!*\n\n🎬 *Query:* _${query}_\n💡 *Tip:* _Please check the spelling and try again!_${DEFAULT_FOOTER}`
            }, { quoted: msg });
            break;
        }

        const results = searchData.data.slice(0, 25);
        let listText = `*❪ SEARCH RESULTS ❫*\n\n🎯 *Query:* _${query}_\n📊 *Results:* _${results.length} Items_\n\n*👇 SELECT A NUMBER 👇*\n\n`;

        results.forEach((item, index) => {
            const num = (index + 1) < 10 ? `0${index + 1}` : `${index + 1}`;
            listText += `*${num}* ➜ 📺 _${item.title.substring(0, 30)}_\n`;
        });

        listText += `${DEFAULT_FOOTER}`;
        
        const sentMsg = await socket.sendMessage(sender, { text: listText }, { quoted: msg });
        const messageID = sentMsg.key.id;

        const handleSelection = async ({ messages: replyMessages }) => {
            const replyMek = replyMessages[0];
            if (!replyMek?.message) return;

            const messageType = replyMek.message.conversation || replyMek.message.extendedTextMessage?.text;
            const isReplyToSentMsg = replyMek.message.extendedTextMessage?.contextInfo?.stanzaId === messageID;

            if (isReplyToSentMsg && sender === replyMek.key.remoteJid) {
                const choice = parseInt(messageType) - 1;
                if (choice < 0 || choice >= results.length || isNaN(choice)) {
                    await socket.sendMessage(sender, {
                        text: `*❪ INVALID ❫*\n\n⚠️ *Wrong Number!*\n🎯 *Range:* _01 - ${results.length}_\n📝 _Please reply with a valid number!_${DEFAULT_FOOTER}`
                    }, { quoted: replyMek });
                    return;
                }

                const selectedItem = results[choice];
                
                await socket.sendMessage(sender, { 
                    text: `*❪ FETCHING ❫*\n\n📺 *Fetching Anime Details...*\n⚡ _Please wait..._`
                }, { quoted: replyMek });

                try {
                    const detailsResponse = await axios.get(`${API_BASE}/api/v1/movie/animost/infodl?q=${encodeURIComponent(selectedItem.link)}&api_key=${API_KEY}`);
                    const detailsData = detailsResponse.data;

                    if (!detailsData.status || !detailsData.data) {
                        throw new Error('Failed to fetch details');
                    }

                    const animeInfo = detailsData.data;
                    const validDownloads = animeInfo.downloads || [];
                    
                    if (validDownloads.length === 0) {
                        await socket.sendMessage(sender, {
                            text: `*❪ NO DOWNLOADS ❫*\n\n⚠️ *No Downloads Found!*\n😞 _There are no downloads available for this anime!_${DEFAULT_FOOTER}`
                        }, { quoted: replyMek });
                        return;
                    }
                    
                    const detailsText = `*❪ ANIME DETAILS ❫*\n\n🎬 *${animeInfo.title}*\n⭐ 𝗜𝗠𝗗𝗕 ➜ ★ ${animeInfo.imdb || animeInfo.rating || 'N/A'}\n📅 𝗬𝗲𝗮𝗿 ➜ ${animeInfo.year || 'N/A'}\n⏳ 𝗗𝘂𝗿𝗮𝘁𝗶𝗼𝗻 ➜ ${animeInfo.duration || 'N/A'}\n🌍 𝗖ᴏᴜɴ𝘁𝗿ʏ ➜ ${animeInfo.country || 'N/A'}\n🎭 𝗚𝗲𝗻 genres ➜ ${animeInfo.genres ? animeInfo.genres.join(', ') : 'N/A'}\n🏷️ ➜ ${animeInfo.language || 'N/A'}\n🎬  ➜ ${animeInfo.director || 'N/A'}\n📝 𝗦𝘁𝗼𝗿𝘆 ➜ ${animeInfo.story ? (animeInfo.story.length > 250 ? animeInfo.story.substring(0, 250) + '...' : animeInfo.story) : 'N/A'}\n🗿  ➜ animost.net\n${DEFAULT_FOOTER}`;

                    const posterUrl = animeInfo.image || selectedItem.image || DEFAULT_IMAGE;
                    await socket.sendMessage(sender, {
                        image: { url: posterUrl },
                        caption: detailsText
                    }, { quoted: replyMek });

                    const downloadOptionsText = `*❪ DOWNLOADS ❫*\n\n📥 *Select Episode / Quality:*\n\n${validDownloads.map((dl, i) => {
    const num = (i + 1) < 10 ? `0${i + 1}` : `${i + 1}`;
    return `*${num}* ➜ 💾 _${dl.quality}_ 📁 _${dl.size || 'N/A'}_`;
}).join('\n')}\n\n*💬 REPLY TO DOWNLOAD 💬*\n📌 _Reply with the number_${DEFAULT_FOOTER}`;

                    const downloadOptionsMsg = await socket.sendMessage(sender, { text: downloadOptionsText }, { quoted: replyMek });
                    const optionsMsgID = downloadOptionsMsg.key.id;

                    const handleDownload = async ({ messages: downloadMessages }) => {
                        const downloadMek = downloadMessages[0];
                        if (!downloadMek?.message) return;

                        const downloadChoice = downloadMek.message.conversation || downloadMek.message.extendedTextMessage?.text;
                        const isReplyToOptionsMsg = downloadMek.message.extendedTextMessage?.contextInfo?.stanzaId === optionsMsgID;

                        if (isReplyToOptionsMsg && sender === downloadMek.key.remoteJid) {
                            const choiceNum = parseInt(downloadChoice) - 1;
                            
                            if (isNaN(choiceNum) || choiceNum < 0 || choiceNum >= validDownloads.length) {
                                await socket.sendMessage(sender, {
                                    text: `*❪ INVALID ❫*\n\n⚠️ *Wrong Number!*\n🎯 *Range:* _01 - ${results.length}_\n📝 _Please reply with a valid number!_${DEFAULT_FOOTER}`
                                }, { quoted: downloadMek });
                                return;
                            }

                            const selectedDownload = validDownloads[choiceNum];
                            await socket.sendMessage(sender, { react: { text: '📥', key: downloadMek.key } });

                            try {
                                const finalDirectLink = selectedDownload.link;

                                await socket.sendMessage(sender, {
                                    document: { url: finalDirectLink },
                                    mimetype: 'video/mp4',
                                    fileName: `${animeInfo.title} - ${selectedDownload.quality}.mp4`,
                                    caption: `*❪ ANIME ❫*\n\n🎭 *${animeInfo.title}*\n📌 *Episode:* _${selectedDownload.quality}_${DEFAULT_FOOTER}`
                                }, { quoted: downloadMek });

                                await socket.sendMessage(sender, { react: { text: '✅', key: downloadMek.key } });

                            } catch (downloadError) {
                                console.error('Download link error:', downloadError);
                                await socket.sendMessage(sender, {
                                    text: `*❪ ERROR ❫*\n\n❌ *Download Failed!*\n🚫 _${downloadError.message}_${DEFAULT_FOOTER}`
                                }, { quoted: downloadMek });
                            } finally {
                                socket.ev.off('messages.upsert', handleDownload);
                                socket.ev.off('messages.upsert', handleSelection);
                            }
                        }
                    };

                    socket.ev.on('messages.upsert', handleDownload);

                } catch (detailsError) {
                    console.error('Details error:', detailsError);
                    await socket.sendMessage(sender, {
                        text: `*❪ ERROR ❫*\n\n❌ *Anime Details Error!*\n🚫 _${detailsError.message}_${DEFAULT_FOOTER}`
                    }, { quoted: replyMek });
                    socket.ev.off('messages.upsert', handleSelection);
                }
            }
        };

        socket.ev.on('messages.upsert', handleSelection);

    } catch (error) {
        console.error('Animost command error:', error);
        await socket.sendMessage(sender, {
            text: `*❪ SYSTEM ERROR ❫*\n\n❌ *System Error!*\n🚫 _${error.message || 'Unknown error'}_\n\n🔄 _Please try again later..._${DEFAULT_FOOTER}`
        }, { quoted: msg });
    }
    
    break;
		}
//////////////////////////////////////////////////////
			  case 'moviesublk':             
case 'msublk': {
    const DEFAULT_FOOTER = `\n\n> 🎭 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘🎭\n> 🧬 ᴘᴏᴡᴇʀᴇᴅ ʙʏ 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘`;

    if (!args.length) {
        await socket.sendMessage(sender, {
            text: `*❪ ERROR ❫*\n\n⚠️ *Invalid Usage!*\n\n🎬 *Example:*
• .moviesublk spider man
• .msublk game of thrones\n\n📝 _Please provide the Movie_ _or TV Series name!_${DEFAULT_FOOTER}`
        }, { quoted: msg });
        break;
    }

    const query = args.join(' ');
    await socket.sendMessage(sender, { 
        text: `*❪ SEARCHING ❫*\n\n🔍 *Searching MovieSubLK...*\n⚡ _Please wait a moment._`
    });

    const API_BASE = "https://chama-movie-api.koyeb.app";
    const API_KEY = "chama_api_23c3e7ffb034f25cf474f6d7ac266f9b"; // ඔබේ API Key එක දාන්න
    const DEFAULT_IMAGE = "https://chama-movie-api.koyeb.app/logo.png";

    try {
        const searchResponse = await axios.get(`${API_BASE}/api/v1/movie/moviesublk/search?q=${encodeURIComponent(query)}&api_key=${API_KEY}`);
        const searchData = searchResponse.data;

        if (!searchData.status || !searchData.data || searchData.data.length === 0) {
            await socket.sendMessage(sender, {
                text: `*❪ NO RESULTS ❫*\n\n😞 *No Results Found!*\n\n🎬 *Query:* _${query}_\n💡 *Tip:* _Please check the spelling and try again!_${DEFAULT_FOOTER}`
            }, { quoted: msg });
            break;
        }

        const results = searchData.data.slice(0, 25);
        let listText = `*❪ SEARCH RESULTS ❫*\n\n🎯 *Query:* _${query}_\n📊 *Results:* _${results.length} Items_\n\n*👇 SELECT A NUMBER 👇*\n\n`;

        results.forEach((item, index) => {
            const typeIcon = item.type === 'tvshows' ? '📺' : '🎥';
            const num = (index + 1) < 10 ? `0${index + 1}` : `${index + 1}`;
            listText += `*${num}* ➜ ${typeIcon} _${item.title.substring(0, 30)}_\n`;
        });

        listText += `${DEFAULT_FOOTER}`;
        
        const sentMsg = await socket.sendMessage(sender, { text: listText }, { quoted: msg });
        const messageID = sentMsg.key.id;

        const handleSelection = async ({ messages: replyMessages }) => {
            const replyMek = replyMessages[0];
            if (!replyMek?.message) return;

            const messageType = replyMek.message.conversation || replyMek.message.extendedTextMessage?.text;
            const isReplyToSentMsg = replyMek.message.extendedTextMessage?.contextInfo?.stanzaId === messageID;

            if (isReplyToSentMsg && sender === replyMek.key.remoteJid) {
                const choice = parseInt(messageType) - 1;
                if (isNaN(choice) || choice < 0 || choice >= results.length) {
                    await socket.sendMessage(sender, {
                        text: `*❪ INVALID ❫*\n\n⚠️ *Wrong Number!*\n🎯 *Range:* _01 - ${results.length}_\n📝 _Please reply with a valid number!_${DEFAULT_FOOTER}`
                    }, { quoted: replyMek });
                    return;
                }

                const selectedItem = results[choice];
                const isTvShow = selectedItem.type === 'tvshows';
                
                if (isTvShow) {
                    await socket.sendMessage(sender, { 
                        text: `*❪ FETCHING ❫*\n\n📺 *Fetching TV Series...*\n⚡ _Please wait..._`
                    }, { quoted: replyMek });

                    try {
                        const tvShowResponse = await axios.get(`${API_BASE}/api/v1/movie/moviesublk/tv/info?q=${encodeURIComponent(selectedItem.link)}&api_key=${API_KEY}`);
                        const tvShowData = tvShowResponse.data;

                        if (!tvShowData.status || !tvShowData.data) {
                            throw new Error('Failed to fetch TV show details');
                        }

                        const tvInfo = tvShowData.data;
                        
                        let tvDetailsText = `*❪ TV SERIES DETAILS ❫*\n\n📺 *${tvInfo.title}*\n⭐ 𝗜ᴍᴅ𝗯 ➜ ★ ${tvInfo.rating || 'N/A'}\n📅 𝗬ᴇᴀʀ ➜ ${tvInfo.year || 'N/A'}\n⏳ 𝗥ᴜɴᴛɪᴍᴇ ➜ ${tvInfo.duration || 'N/A'}\n🌍 𝗖ᴏᴜɴ𝘁𝗿ʏ ➜ ${tvInfo.country || 'N/A'}\n🎭 𝗚𝗲𝗻 genres ➜ ${tvInfo.genres ? tvInfo.genres.join(', ') : 'N/A'}\n📝 𝗦𝘁𝗼𝗿𝘆 ➜ ${tvInfo.story ? (tvInfo.story.length > 250 ? tvInfo.story.substring(0, 250) + '...' : tvInfo.story) : 'N/A'}\n🗿 𝗪ᴇʙ ➜ moviesublk.xyz\n ${DEFAULT_FOOTER}`;

                        const posterUrl = tvInfo.image || selectedItem.image || DEFAULT_IMAGE;
                        await socket.sendMessage(sender, {
                            image: { url: posterUrl },
                            caption: tvDetailsText
                        }, { quoted: replyMek });

                        // AUTO DOWNLOAD ALL EPISODES
                        await socket.sendMessage(sender, { 
                            text: `*❪ DOWNLOAD EPISODES ❫*\n\n📺 *Series:* _${tvInfo.title}_
🎬 *Episodes:* _${tvInfo.episodes.length}_
⚡ _Starting download process..._	ext ${DEFAULT_FOOTER}`
                        }, { quoted: replyMek });

                        let successCount = 0;
                        let failCount = 0;

                        for (let i = 0; i < tvInfo.episodes.length; i++) {
                            const episode = tvInfo.episodes[i];
                            try {
                                await socket.sendMessage(sender, { 
                                    text: `*❪ DOWNLOADING ❫*\n\n🎥 *Episode:* _${episode.episode_name}_
📊 *Progress:* _${i + 1}/${tvInfo.episodes.length}_`
                                }, { quoted: replyMek });

                                const epDlRes = await axios.get(`${API_BASE}/api/v1/movie/moviesublk/tv/dl?q=${encodeURIComponent(episode.episode_url)}&api_key=${API_KEY}`);
                                const epDlData = epDlRes.data;

                                if (epDlData.status && epDlData.data && epDlData.data.length > 0) {
                                    const nonTelegramLinks = epDlData.data.filter(link => 
                                        link.link && !link.link.includes('t.me') && !link.link.includes('telegram')
                                    );
                                    const finalLinkObj = nonTelegramLinks[0] || epDlData.data[0];
                                    
                                    await socket.sendMessage(sender, {
                                        document: { url: finalLinkObj.link },
                                        mimetype: 'video/mp4',
                                        fileName: `${tvInfo.title} - ${episode.episode_name}.mp4`,
                                        caption: `*📺 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘 📺*\n\n🎭 *Title:* ${tvInfo.title}\n📌 *Episode:* ${episode.episode_name}\n📊 *Quality:* Direct MP4\n\n${DEFAULT_FOOTER}`
                                    }, { quoted: replyMek });
                                    
                                    successCount++;
                                } else {
                                    failCount++;
                                }
                                
                                await new Promise(resolve => setTimeout(resolve, 2500));
                                
                            } catch (epError) {
                                console.error(`Error downloading episode:`, epError);
                                failCount++;
                            }
                        }
                        
                        await socket.sendMessage(sender, { 
                            text: `*❪ SUMMARY ❫*\n\n🎉 *Download Complete!*\n\n🎬 *Series:* _${tvInfo.title}_\n✅ *Success:* _${successCount} Episodes_\n❌ *Failed:* _${failCount} Episodes_${DEFAULT_FOOTER}`
                        }, { quoted: replyMek });

                        socket.ev.off('messages.upsert', handleSelection);
                        
                    } catch (tvShowError) {
                        console.error('TV Show error:', tvShowError);
                        await socket.sendMessage(sender, {
                            text: `*❪ ERROR ❫*\n\n❌ *TV Details Error!*\n🚫 _${tvShowError.message}_${DEFAULT_FOOTER}`
                        }, { quoted: replyMek });
                        socket.ev.off('messages.upsert', handleSelection);
                    }
                    
                } else {
                    // MOVIE FLOW
                    await socket.sendMessage(sender, { 
                        text: `*❪ FETCHING ❫*\n\n🎬 *Fetching Movie...*\n⚡ _Please wait..._`
                    }, { quoted: replyMek });

                    try {
                        const detailsResponse = await axios.get(`${API_BASE}/api/v1/movie/moviesublk/infodl?q=${encodeURIComponent(selectedItem.link)}&api_key=${API_KEY}`);
                        const detailsData = detailsResponse.data;

                        if (!detailsData.status || !detailsData.data) {
                            throw new Error('Failed to fetch details');
                        }

                        const movieInfo = detailsData.data;
                        const validDownloads = movieInfo.downloads || [];
                        
                        if (validDownloads.length === 0) {
                            await socket.sendMessage(sender, {
                                text: `*❪ NO DOWNLOADS ❫*\n\n⚠️ *No Downloads Found!*\n😞 _There are no downloads available for this movie!_${DEFAULT_FOOTER}`
                            }, { quoted: replyMek });
                            return;
                        }
                        
                        const movieDetailsText = `*❪ MOVIE DETAILS ❫*\n\n🎬 *${movieInfo.title}*\n⭐ 𝗜𝗠𝗗𝗕 ➜ ★ ${movieInfo.imdb || movieInfo.rating || 'N/A'}\n📅 𝗬𝗲𝗮𝗿 ➜ ${movieInfo.year || 'N/A'}\n⏳ 𝗗𝘂𝗿𝗮𝘁𝗶𝗼𝗻 ➜ ${movieInfo.duration || 'N/A'}\n🌍 𝗖ᴏᴜɴ𝘁𝗿ʏ ➜ ${movieInfo.country || 'N/A'}\n🎭 𝗚𝗲𝗻 genres ➜ ${movieInfo.genres ? movieInfo.genres.join(', ') : 'N/A'}\n🏷️  ➜ ${movieInfo.language || movieInfo.tag || 'N/A'}\n🎬  ➜ ${movieInfo.directors || movieInfo.director || 'N/A'}\n⭐  ➜ ${movieInfo.stars || 'N/A'}\n📝  ➜ ${movieInfo.story ? (movieInfo.story.length > 250 ? movieInfo.story.substring(0, 250) + '...' : movieInfo.story) : 'N/A'}\n🗿 𝗪ᴇʙ ➜ moviesublk.xyz\n ${DEFAULT_FOOTER}`;

                        const moviePosterUrl = movieInfo.image || selectedItem.image || DEFAULT_IMAGE;
                        await socket.sendMessage(sender, {
                            image: { url: moviePosterUrl },
                            caption: movieDetailsText
                        }, { quoted: replyMek });

                        const downloadOptionsText = `*❪ DOWNLOADS ❫*\n\n📥 *Select Quality:*\n\n${validDownloads.map((dl, i) => {
    const num = (i + 1) < 10 ? `0${i + 1}` : `${i + 1}`;
    const qualityIcon = (dl.quality || '').includes('1080') ? '🔥' : (dl.quality || '').includes('720') ? '💎' : '📱';
    return `*${num}* ➜ ${qualityIcon} _${dl.quality}_ 💾 _${dl.size || 'N/A'}_`;
}).join('\n')}\n\n*💬 REPLY TO DOWNLOAD 💬*\n📌 _Reply with the number_${DEFAULT_FOOTER}`;

                        const downloadOptionsMsg = await socket.sendMessage(sender, { text: downloadOptionsText }, { quoted: replyMek });
                        const optionsMsgID = downloadOptionsMsg.key.id;

                        const handleDownload = async ({ messages: downloadMessages }) => {
                            const downloadMek = downloadMessages[0];
                            if (!downloadMek?.message) return;

                            const downloadChoice = downloadMek.message.conversation || downloadMek.message.extendedTextMessage?.text;
                            const isReplyToOptionsMsg = downloadMek.message.extendedTextMessage?.contextInfo?.stanzaId === optionsMsgID;

                            if (isReplyToOptionsMsg && sender === downloadMek.key.remoteJid) {
                                const choiceNum = parseInt(downloadChoice) - 1;
                                
                                if (isNaN(choiceNum) || choiceNum < 0 || choiceNum >= validDownloads.length) {
                                    await socket.sendMessage(sender, {
                                        text: `*❪ INVALID ❫*\n\n⚠️ *Wrong Number!*\n🎯 *Range:* _01 - ${validDownloads.length}_\n📝 _Please reply with a valid number!_	ext ${DEFAULT_FOOTER}`
                                    }, { quoted: downloadMek });
                                    return;
                                }

                                const selectedDownload = validDownloads[choiceNum];
                                await socket.sendMessage(sender, { react: { text: '📥', key: downloadMek.key } });

                                try {
                                    const finalDirectLink = selectedDownload.link;

                                    await socket.sendMessage(sender, {
                                        document: { url: finalDirectLink },
                                        mimetype: 'video/mp4',
                                        fileName: `${movieInfo.title} - ${selectedDownload.quality}.mp4`,
                                        caption: `*🎬 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘 𝗖𝗜𝗡𝗘 𝗠𝗢𝗩𝗜𝗘 🎬*\n\n🎭 *Title:* ${movieInfo.title}\n🌟 *IMDB:* ${movieInfo.imdb || movieInfo.rating || 'N/A'}\n📅 *Year:* ${movieInfo.year || 'N/A'}\n📊 *Quality:* ${selectedDownload.quality}\n💾 *Size:* ${selectedDownload.size || 'N/A'}\n\n${DEFAULT_FOOTER}`
                                    }, { quoted: downloadMek });

                                    await socket.sendMessage(sender, { react: { text: '✅', key: downloadMek.key } });

                                } catch (downloadError) {
                                    console.error('Download link error:', downloadError);
                                    await socket.sendMessage(sender, {
                                        text: `*❪ ERROR ❫*\n\n❌ *Download Failed!*\n🚫 _${downloadError.message}_${DEFAULT_FOOTER}`
                                    }, { quoted: downloadMek });
                                } finally {
                                    socket.ev.off('messages.upsert', handleDownload);
                                    socket.ev.off('messages.upsert', handleSelection);
                                }
                            }
                        };

                        socket.ev.on('messages.upsert', handleDownload);

                    } catch (detailsError) {
                        console.error('Details error:', detailsError);
                        await socket.sendMessage(sender, {
                            text: `*❪ ERROR ❫*\n\n❌ *Movie Details Error!*\n🚫 _${detailsError.message}_${DEFAULT_FOOTER}`
                        }, { quoted: replyMek });
                        socket.ev.off('messages.upsert', handleSelection);
                    }
                }
            }
        };

        socket.ev.on('messages.upsert', handleSelection);

    } catch (error) {
        console.error('Moviesublk command error:', error);
        await socket.sendMessage(sender, {
            text: `*❪ SYSTEM ERROR ❫*\n\n❌ *System Error!*\n🚫 _${error.message || 'Unknown error'}_\n\n🔄 _Please try again later..._${DEFAULT_FOOTER}`
        }, { quoted: msg });
    }
    
    break;
							}
////////////////////////////////////////////////////
			  case 'sinhalacartoons':             
case 'cartoon': {
    const DEFAULT_FOOTER = `\n\n> 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘 𝙲𝙸𝙽𝙴 𝙷𝚄𝙱 \n> 🧬 ᴘᴏᴡᴇʀᴇᴅ ʙʏ 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘`;

    if (!args.length) {
        await socket.sendMessage(sender, {
            text: `*❪ ERROR ❫*\n\n⚠️ *Invalid Usage!*\n\n🎬 *Example:*
• .cartoon ben 10
• .sinhalacartoons frozen\n\n📝 _Please provide the Cartoon_ _or Anime name!_${DEFAULT_FOOTER}`
        }, { quoted: msg });
        break;
    }

    const query = args.join(' ');
    await socket.sendMessage(sender, { 
        text: `*❪ SEARCHING ❫*\n\n🔍 *Searching Sinhalacartoons...*\n⚡ _Please wait a moment._`
    });

    const API_BASE = "https://chama-movie-api.koyeb.app";
    const API_KEY = "chama_api_23c3e7ffb034f25cf474f6d7ac266f9b"; // ඔබේ API Key එක දාන්න
    const DEFAULT_IMAGE = "https://chama-movie-api.koyeb.app/logo.png";

    try {
        const searchResponse = await axios.get(`${API_BASE}/api/v1/movie/sinhalacartoons/search?q=${encodeURIComponent(query)}&api_key=${API_KEY}`);
        const searchData = searchResponse.data;

        if (!searchData.status || !searchData.data || searchData.data.length === 0) {
            await socket.sendMessage(sender, {
                text: `*❪ NO RESULTS ❫*\n\n😞 *No Results Found!*\n\n🎬 *Query:* _${query}_\n💡 *Tip:* _Please check the spelling and try again!_${DEFAULT_FOOTER}`
            }, { quoted: msg });
            break;
        }

        const results = searchData.data.slice(0, 25);
        let listText = `*❪ SEARCH RESULTS ❫*\n\n🎯 *Query:* _${query}_\n📊 *Results:* _${results.length} Items_\n\n*👇 SELECT A NUMBER 👇*\n\n`;

        results.forEach((item, index) => {
            const num = (index + 1) < 10 ? `0${index + 1}` : `${index + 1}`;
            listText += `*${num}* ➜ 📺 _${item.title.substring(0, 30)}_\n`;
        });

        listText += `${DEFAULT_FOOTER}`;
        
        const sentMsg = await socket.sendMessage(sender, { text: listText }, { quoted: msg });
        const messageID = sentMsg.key.id;

        const handleSelection = async ({ messages: replyMessages }) => {
            const replyMek = replyMessages[0];
            if (!replyMek?.message) return;

            const messageType = replyMek.message.conversation || replyMek.message.extendedTextMessage?.text;
            const isReplyToSentMsg = replyMek.message.extendedTextMessage?.contextInfo?.stanzaId === messageID;

            if (isReplyToSentMsg && sender === replyMek.key.remoteJid) {
                const choice = parseInt(messageType) - 1;
                if (isNaN(choice) || choice < 0 || choice >= results.length) {
                    await socket.sendMessage(sender, {
                        text: `*❪ INVALID ❫*\n\n⚠️ *Wrong Number!*\n🎯 *Range:* _01 - ${results.length}_\n📝 _Please reply with a valid number!_${DEFAULT_FOOTER}`
                    }, { quoted: replyMek });
                    return;
                }

                const selectedItem = results[choice];
                
                await socket.sendMessage(sender, { 
                    text: `*❪ FETCHING ❫*\n\n📺 *Fetching Cartoon Details...*\n⚡ _Please wait..._`
                }, { quoted: replyMek });

                try {
                    const detailsResponse = await axios.get(`${API_BASE}/api/v1/movie/sinhalacartoons/infodl?q=${encodeURIComponent(selectedItem.link)}&api_key=${API_KEY}`);
                    const detailsData = detailsResponse.data;

                    if (!detailsData.status || !detailsData.data) {
                        throw new Error('Failed to fetch details');
                    }

                    const cartoonInfo = detailsData.data;
                    const validDownloads = cartoonInfo.downloads || [];
                    
                    if (validDownloads.length === 0) {
                        await socket.sendMessage(sender, {
                            text: `*❪ NO DOWNLOADS ❫*\n\n⚠️ *No Downloads Found!*\n😞 _There are no downloads available for this cartoon!_${DEFAULT_FOOTER}`
                        }, { quoted: replyMek });
                        return;
                    }
                    
                    const detailsText = `*❪ CARTOON DETAILS ❫*\n\n🎬 *${cartoonInfo.title}*\n⭐ 𝗜𝗠𝗗𝗕 ➜ ★ ${cartoonInfo.imdb || cartoonInfo.rating || 'N/A'}\n📅 𝗬𝗲𝗮𝗿 ➜ ${cartoonInfo.year || 'N/A'}\n⏳ 𝗗𝘂𝗿𝗮𝘁𝗶𝗼𝗻 ➜ ${cartoonInfo.duration || 'N/A'}\n🌍 𝗖ᴏᴜɴ𝘁𝗿ʏ ➜ ${cartoonInfo.country || 'N/A'}\n🎭 𝗚𝗲𝗻 genres ➜ ${cartoonInfo.genres ? cartoonInfo.genres.join(', ') : 'N/A'}\n🏷️ ➜ ${cartoonInfo.language || 'N/A'}\n🎬  ➜ ${cartoonInfo.director || 'N/A'}\n📝 𝗦𝘁𝗼𝗿𝘆 ➜ ${cartoonInfo.story ? (cartoonInfo.story.length > 250 ? cartoonInfo.story.substring(0, 250) + '...' : cartoonInfo.story) : 'N/A'}\n🗿  ➜ sinhalacartoons.com\n${DEFAULT_FOOTER}`;

                    const posterUrl = cartoonInfo.image || selectedItem.image || DEFAULT_IMAGE;
                    await socket.sendMessage(sender, {
                        image: { url: posterUrl },
                        caption: detailsText
                    }, { quoted: replyMek });

                    const downloadOptionsText = `*❪ DOWNLOADS ❫*\n\n📥 *Select Episode / Quality:*\n\n${validDownloads.map((dl, i) => {
    const num = (i + 1) < 10 ? `0${i + 1}` : `${i + 1}`;
    return `*${num}* ➜ 💾 _${dl.quality}_ 📁 _${dl.size || 'N/A'}_`;
}).join('\n')}\n\n*💬 REPLY TO DOWNLOAD 💬*\n📌 _Reply with the number_${DEFAULT_FOOTER}`;

                    const downloadOptionsMsg = await socket.sendMessage(sender, { text: downloadOptionsText }, { quoted: replyMek });
                    const optionsMsgID = downloadOptionsMsg.key.id;

                    const handleDownload = async ({ messages: downloadMessages }) => {
                        const downloadMek = downloadMessages[0];
                        if (!downloadMek?.message) return;

                        const downloadChoice = downloadMek.message.conversation || downloadMek.message.extendedTextMessage?.text;
                        const isReplyToOptionsMsg = downloadMek.message.extendedTextMessage?.contextInfo?.stanzaId === optionsMsgID;

                        if (isReplyToOptionsMsg && sender === downloadMek.key.remoteJid) {
                            const choiceNum = parseInt(downloadChoice) - 1;
                            
                            if (isNaN(choiceNum) || choiceNum < 0 || choiceNum >= validDownloads.length) {
                                await socket.sendMessage(sender, {
                                    text: `*❪ INVALID ❫*\n\n⚠️ *Wrong Number!*\n🎯 *Range:* _01 - ${validDownloads.length}_\n📝 _Please reply with a valid number!_${DEFAULT_FOOTER}`
                                }, { quoted: downloadMek });
                                return;
                            }

                            const selectedDownload = validDownloads[choiceNum];
                            await socket.sendMessage(sender, { react: { text: '📥', key: downloadMek.key } });

                            try {
                                const finalDirectLink = selectedDownload.link;

                                await socket.sendMessage(sender, {
                                    document: { url: finalDirectLink },
                                    mimetype: 'video/mp4',
                                    fileName: `${cartoonInfo.title} - ${selectedDownload.quality}.mp4`,
                                    caption: `*❪ CARTOON ❫*\n\n🎭 *${cartoonInfo.title}*\n📌 *Episode:* _{selectedDownload.quality}_${DEFAULT_FOOTER}`
                                }, { quoted: downloadMek });

                                await socket.sendMessage(sender, { react: { text: '✅', key: downloadMek.key } });

                            } catch (downloadError) {
                                console.error('Download link error:', downloadError);
                                await socket.sendMessage(sender, {
                                    text: `*❪ ERROR ❫*\n\n❌ *Download Failed!*\n🚫 _${downloadError.message}_${DEFAULT_FOOTER}`
                                }, { quoted: downloadMek });
                            } finally {
                                socket.ev.off('messages.upsert', handleDownload);
                                socket.ev.off('messages.upsert', handleSelection);
                            }
                        }
                    };

                    socket.ev.on('messages.upsert', handleDownload);

                } catch (detailsError) {
                    console.error('Details error:', detailsError);
                    await socket.sendMessage(sender, {
                        text: `*❪ ERROR ❫*\n\n❌ *Cartoon Details Error!*\n🚫 _${detailsError.message}_${DEFAULT_FOOTER}`
                    }, { quoted: replyMek });
                    socket.ev.off('messages.upsert', handleSelection);
                }
            }
        };

        socket.ev.on('messages.upsert', handleSelection);

    } catch (error) {
        console.error('Sinhalacartoons command error:', error);
        await socket.sendMessage(sender, {
            text: `*❪ SYSTEM ERROR ❫*\n\n❌ *System Error!*\n🚫 _${error.message || 'Unknown error'}_\n\n🔄 _Please try again later..._${DEFAULT_FOOTER}`
        }, { quoted: msg });
    }
    
    break;
		}
//////////////////////////////////////////
			  case 'my': {
  try { await socket.sendMessage(sender, { react: { text: "🍷", key: msg.key } }); } catch(e){}

  try {
    let userCfg = {};
    try { 
      if (number && typeof loadUserConfigFromMongo === 'function') 
        userCfg = await loadUserConfigFromMongo((number || '').replace(/[^0-9]/g, '')) || {}; 
    } catch(e){ 
      userCfg = {}; 
    }

    const title = userCfg.botName || '© 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘';

    const shonux = {
      key: {
        remoteJid: "status@broadcast",
        participant: "0@s.whatsapp.net",
        fromMe: false,
        id: "META_AI_FAKE_ID_OWNER"
      },
      message: {
        contactMessage: {
          displayName: title,
          vcard: `BEGIN:VCARD
VERSION:3.0
N:${title};;;;
FN:${title}
ORG:Meta Platforms
TEL;type=CELL;type=VOICE;waid=13135550002:+1 313 555 0002
END:VCARD`
        }
      }
    };

    const text = `
*╭─「𝐌𝐘 𝐈nfo」 ──●●➤*
*✘ 𝘕𝘢𝘮𝘦 =* *MADUSANKA *
*✘ 𝘈𝘨𝘦 =* *17*
*✘ 𝘕𝘣 =* *+94783731694*
*╰──────────●●➤*
> *💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘 𝐁ᴏᴛ*
`.trim();

    await socket.sendMessage(sender, {
      text,
      footer: "🥷 𝘖𝘸𝘯𝘦𝘳 𝘐𝘯𝘧𝘰𝘳𝘮𝘢𝘵𝘪𝘰𝘯"
    }, { quoted: shonux });

  } catch (err) {
    console.error('owner command error:', err);
    try { 
      await socket.sendMessage(sender, { text: '❌ Failed to show owner info.' }, { quoted: msg }); 
    } catch(e){}
  }
  break;
			  }
			  
////////////////////////////////////////////////////////////////
        case 'menu':
        case 'help':
        case 'list': {
            await socket.sendMessage(sender, { react: { text: '🧚‍♂️', key: msg.key } });

            const prefixUsed = sessionConfig.PREFIX || config.PREFIX || '.';
            const userMention = `@${sender.split('@')[0]}`;
            const botName = sessionConfig.BOT_NAME || config.BOT_NAME || '🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD';
            const footerText = sessionConfig.BOT_FOOTER || config.BOT_FOOTER || '🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD';

            let menuText = `*╭───❪ 👑 ${botName.toUpperCase()} MENU 👑 ❫───*\n` +
                `*│* 👤 *User:* ${userMention}\n` +
                `*│* ⚡ *Prefix:* \`${prefixUsed}\`\n` +
                `*│* 🤖 *Engine:* _${botName}_\n` +
                `*│* 💖 *Developer:* _MADUSANKA-OFC_\n` +
                `*╰─────────────────────────────*\n\n` +

                `*╭───〔 🎬 MOVIE & TV SERIES ENGINE 〕───*\n` +
                `*│* 🎬 \`${prefixUsed}cmovie <targetJid> <movie>\` ➜ Multi-Site Channel Forwarder\n` +
				`*│* 🪷 \`${prefixUsed}ridomovies <ridomovies_name>\` ➜ ridomovies Search\n` +
                `*│* 🎥 \`${prefixUsed}movie <movie_name>\` ➜ Multi-Site Chat Search\n` +
				`*│* 🎞️ \`${prefixUsed}Cartoon <Cartoon_name>\` ➜ Cartoon Search\n` +
				`*│* 🧸 \`${prefixUsed}Zoom <Zoom_name>\` ➜ Zoom.lk Search\n` +
				`*│* 🔍 \`${prefixUsed}anime <anime_name>\` ➜ anime Search\n` +
                `*│* 📺 \`${prefixUsed}cinesubz <movie_name>\` ➜ CineSubz Search\n` +
				`*│* 🖥️ \`${prefixUsed}moviesublk <moviesublk_name>\` ➜ moviesublk Search\n` +
                `*│* 🎬 \`${prefixUsed}sinhalasub <movie_name>\` ➜ SinhalaSub Search\n` +
                `*│* 🎥 \`${prefixUsed}baiscope <movie_name>\` ➜ Baiscope LK Search\n` +
                `*│* 🎬 \`${prefixUsed}thenkiri <movie_name>\` ➜ Thenkiri Search\n` +
                `*│* 🍿 \`${prefixUsed}lakvision\` | \`${prefixUsed}lak <name>\` ➜ LakvisionTV Search\n` +
                `*│* 📺 \`${prefixUsed}moviebox <movie_name>\` ➜ MovieBox DL Search\n` +
                `*╰─────────────────────────────*\n\n` +

                `*╭───〔 🎵 MUSIC & MEDIA DOWNLOADERS 〕───*\n` +
                `*│* 🎵 \`${prefixUsed}song <song_name/url>\` ➜ Direct MP3 Song Downloader\n` +
                `*│* 🎧 \`${prefixUsed}csong <targetJid> <song_name>\` ➜ Download & Forward Song\n` +
				`*│* 🪷 \`${prefixUsed}asong <autosong> <song_name>\` ➜ Download speed Song\n` +
                `*│* 📹 \`${prefixUsed}fb <video_url>\` ➜ Facebook Video Downloader\n` +
                `*│* 🎮 \`${prefixUsed}game\` | \`${prefixUsed}fitgirl <game_name>\` ➜ FitGirl PC Games\n` +
                `*╰─────────────────────────────*\n\n` +

                `*╭───〔 🔞 ADULT & ANIME ENGINE 〕───*\n` +
                `*│* 🔞 \`${prefixUsed}hanime\` | \`${prefixUsed}hhentai <title>\` ➜ Hanime.tv Search & MP4\n` +
                `*│* 🎥 \`${prefixUsed}xnxx\` | \`${prefixUsed}xvideos\` | \`${prefixUsed}xtube <query>\` ➜ Adult Media\n` +
                `*╰─────────────────────────────*\n\n` +

                `*╭───〔 🚀 SYSTEM & FILE UTILITIES 〕───*\n` +
                `*│* 📢 \`${prefixUsed}cid\` | \`${prefixUsed}channelid <link>\` ➜ WhatsApp Channel JID\n` +
                `*│* 📁 \`${prefixUsed}cfile <targetJid>\` ➜ Forward Quoted Media with Title\n` +
                `*│* 🔄 \`${prefixUsed}forward\` | \`${prefixUsed}fv <targetJid>\` ➜ Instant Media Forward\n` +
                `*│* ✏️ \`${prefixUsed}rename <new_filename>\` ➜ Rename Quoted Document\n` +
                `*│* 🖼️ \`${prefixUsed}tourl\` | \`${prefixUsed}imgbb\` | \`${prefixUsed}catbox\` ➜ Upload Media to Web URL\n` +
                `*│* 🆔 \`${prefixUsed}jid\` ➜ Get Chat / Group / Channel JID\n` +
                `*│* 🏓 \`${prefixUsed}ping\` ➜ Check Bot Latency Speed\n` +
				`*│* 🧸 \`${prefixUsed}alive\` ➜ alive - Bot status Speed\n` +
				`*│* 🧭 \`${prefixUsed}time\` ➜ time - country code time\n` +
                `*│* 👑 \`${prefixUsed}owner\` ➜ View Bot Owner Contact Card\n` +
                `*╰─────────────────────────────*\n\n` +

                `*╭───〔 👥 GROUP & ADMIN TOOLS 〕───*\n` +
                `*│* 📊 \`${prefixUsed}groupstatus\` | \`${prefixUsed}gstatus\` ➜ Group Metadata & Admins\n` +
                `*│* ⚙️ \`${prefixUsed}setting <KEY:VALUE>\` ➜ System Configurations\n` +
                `*│* 🗳️ \`${prefixUsed}vote <option_index>\` ➜ Poll Voting\n` +
                `*╰─────────────────────────────*\n\n` +

                `*╭───〔 🤖 AUTO STATUS & REACTIONS 〕───*\n` +
                `*│* 📲 \`${prefixUsed}status <text/media>\` ➜ Post Status Story\n` +
                `*│* 🔄 \`${prefixUsed}autostatus <true/false>\` ➜ Toggle Auto Status Viewer\n` +
                `*│* 💚 \`${prefixUsed}statusemoji <emoji>\` ➜ Change Status Reaction Emoji\n` +
                `*│* ➕ \`${prefixUsed}addreact <channel_link> [emojis]\` ➜ Add Channel Auto React\n` +
                `*│* ➖ \`${prefixUsed}delreact <channel_link>\` ➜ Remove Channel Auto React\n` +
                `*│* 📜 \`${prefixUsed}listreact\` ➜ List Channel Auto Reactions\n` +
                `*╰─────────────────────────────*\n\n` +

                `> ${footerText}`;

            return await socket.sendMessage(msg.key.remoteJid, {
                text: menuText,
                mentions: [sender]
            }, { quoted: msg });
        }

        case 'setting': {
     
    
    
    // 1. Check for input; if empty, show advanced help
    if (!args.length) {
        let helpText = `*👋 ɢʀᴇᴇᴛɪɴɢs, ᴀᴅᴍɪɴ!*
_sʏsᴛᴇᴍ ᴄᴏɴғɪɢᴜʀᴀᴛɪᴏɴ ᴘᴀɴᴇʟ ɪs ᴏɴʟɪɴᴇ._
*╭─🍀 ʜ ᴏ ᴡ  ᴛ ᴏ  ᴜ s ᴇ─*
*│* 🛠️ *ᴜsᴀɢᴇ :* \`.setting KEY:VALUE\`
*│* 📝 *ᴇxᴀᴍᴘʟᴇ :* \`.setting MODE:public\`
*│* ✨ *ᴍᴜʟᴛɪ :* \`.setting AUTO_VIEW_STATUS:true, AUTO_LIKE_STATUS:true\`
*╰────────────*
*╭─📂 ᴀ ᴠ ᴀ ɪ ʟ ᴀ ʙ ʟ ᴇ  ᴋ ᴇ ʏ s─*
*│* ♦️ \`AUTO_VIEW_STATUS\`
*│* ♦️ \`AUTO_LIKE_STATUS\`
*│* ♦️ \`PREFIX\`
*│* ♦️ \`MODE\`
*│* ♦️ \`BOT_FOOTER\`
*╰──────────*`;

        return await socket.sendMessage(sender, {
            text: `*⚙️ ᴄ ᴏ ɴ ғ ɪ ɢ  ᴍ ᴀ ɴ ᴀ ɢ ᴇ ʀ*\n\n${helpText}\n\n> ${sessionConfig.BOT_FOOTER || config.BOT_FOOTER}`
        }, { quoted: msg });
    }

    const input = args.join(' ');
    const updates = {};
    const validKeys = [
        'AUTO_VIEW_STATUS','BOT_FOOTER','MODE','PREFIX', 'AUTO_LIKE_STATUS'
    ];
    const pairs = input.split(',');
    let hasInvalidKey = false;
    let invalidKeyName = '';

    pairs.forEach(pair => {
        let [key, ...valueParts] = pair.split(':');
        if (!key || valueParts.length === 0) return;

        key = key.trim().toUpperCase();
        let value = valueParts.join(':').trim(); 

        if (validKeys.includes(key)) {
            if (value.toLowerCase() === 'true') {
                updates[key] = 'true';
            } 
            else if (value.toLowerCase() === 'false') {
                updates[key] = 'false';
            } 
            else {
                updates[key] = value;
            }
        } else {
            hasInvalidKey = true;
            invalidKeyName = key;
        }
    });

    if (hasInvalidKey) {
        return await socket.sendMessage(sender, { 
            text: `❌ *ɪɴᴠᴀʟɪᴅ sʏsᴛᴇᴍ ᴋᴇʏ:* \`${invalidKeyName}\`\n\n*Available keys: AUTO_VIEW_STATUS, AUTO_LIKE_STATUS*}` 
        }, { quoted: msg });
    }

    if (Object.keys(updates).length === 0) {
        return await socket.sendMessage(sender, { text: "❌ *ғᴏʀᴍᴀᴛ ᴇʀʀᴏʀ:* Please use `Key:Value` format.\n\nExample: `.set AUTO_VIEW_STATUS:true, AUTO_LIKE_STATUS:false`" });
    }

    try {
        await socket.sendMessage(sender, { react: { text: "⚙️", key: msg.key } });

        sessionConfig = { ...sessionConfig, ...updates };
        await updateUserConfig(sanitizedNumber, sessionConfig);
        activeSockets.set(sanitizedNumber, { socket, config: sessionConfig });

        let updateSummary = Object.entries(updates).map(([k, v]) => {
            return `*│* ✅ *${k}* ➜ \`${v}\``;
        }).join('\n');

        const successMsg = `*🚀 sʏsᴛᴇᴍ ᴄᴏɴғɪɢᴜʀᴀᴛɪᴏɴ ᴜᴘᴅᴀᴛᴇᴅ!*

*╭ᴜ ᴘ ᴅ ᴀ ᴛ ᴇ  ʟ ᴏ ɢ*
${updateSummary}
*╰────────────*

_System changes applied successfully._`;

        await socket.sendMessage(sender, {
            text: `*⚙️ ᴜ ᴘ ᴅ ᴀ ᴛ ᴇ  ᴅ ᴏ ɴ ᴇ*\n\n${successMsg}`
        }, { quoted: msg });

        await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error("Update Error:", error);
        await socket.sendMessage(sender, { text: "❌ *sʏsᴛᴇᴍ ᴄʀɪᴛɪᴄᴀʟ ᴇʀʀᴏʀ:* " + error.message });
    }
}
break; 
case 'forward':
case 'fv': {
    const DEFAULT_FOOTER = sessionConfig.BOT_FOOTER || config.BOT_FOOTER || '💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD 🧚‍♂️';
    const from = sender;

    const quotedInfo = msg.message?.extendedTextMessage?.contextInfo ||
                       msg.message?.imageMessage?.contextInfo ||
                       msg.message?.videoMessage?.contextInfo ||
                       msg.message?.documentMessage?.contextInfo ||
                       msg.message?.audioMessage?.contextInfo;

    if (!quotedInfo || !quotedInfo.quotedMessage) {
        return await socket.sendMessage(from, { 
            text: `❌ *Error: Reply to a movie/file/message to forward!*\n\n📝 *Format 1:* \.fv <targetJid / channel_link>\n📝 *Format 2 (with Caption):* \.fv <targetJid / channel_link> | Custom Caption Here\n\n📌 *Examples:*\n• \.fv 120363408929003946@g.us\n• \.forward https://whatsapp.com/channel/0029VbCi5BT5a23yioUIOp1w | 🎬 Avatar 2024 HD\n\n> ${DEFAULT_FOOTER}`
        }, { quoted: msg });
    }

    const rawArgs = args.join(' ').trim();
    if (!rawArgs) {
        return await socket.sendMessage(from, { 
            text: `❌ *Please provide a target JID or Channel Link!*\n\n📝 *Usage:* \.fv <targetJid / channel_link> [| optional_caption]\n📌 *Example:* \.fv 120363408929003946@g.us\n\n> ${DEFAULT_FOOTER}`
        }, { quoted: msg });
    }

    const parts = rawArgs.split('|');
    let inputJid = parts[0].trim();
    let customCaption = parts.length > 1 ? parts.slice(1).join('|').trim() : null;

    let targetJid = null;

    if (inputJid) {
        if (inputJid.includes('whatsapp.com/channel/')) {
            const inviteCode = inputJid.split('whatsapp.com/channel/')[1].split('/')[0].split('?')[0];
            try {
                const metadata = await socket.newsletterMetadata('invite', inviteCode);
                targetJid = metadata.id;
            } catch (err) {}
        } else if (inputJid.includes('@')) {
            targetJid = inputJid;
        }
    }

    if (!targetJid) {
        return await socket.sendMessage(from, { 
            text: `❌ *Invalid Target JID or Channel Link!*\n\n📝 *Usage:* \.fv <targetJid / channel_link>\n📌 *Example:* \.fv 120363408929003946@g.us\n\n> ${DEFAULT_FOOTER}`
        }, { quoted: msg });
    }

    try {
        await socket.sendMessage(from, { react: { text: "📤", key: msg.key } });

        const quotedMsgObj = quotedInfo.quotedMessage;
        const docMsg = quotedMsgObj.documentMessage || quotedMsgObj.documentWithCaptionMessage?.message?.documentMessage;
        const imgMsg = quotedMsgObj.imageMessage;
        const vidMsg = quotedMsgObj.videoMessage;
        const audMsg = quotedMsgObj.audioMessage;
        const mediaObj = docMsg || imgMsg || vidMsg || audMsg;

        // ULTRA-FAST ZERO-DOWNLOAD RELAY LOGIC (1-2 SECONDS FOR 1.5GB+ FILES)
        if (customCaption && mediaObj && mediaObj.url && mediaObj.mediaKey) {
            const finalCaption = `${customCaption}\n\n> ${DEFAULT_FOOTER}`;
            const mediaType = docMsg ? 'documentMessage' : imgMsg ? 'imageMessage' : vidMsg ? 'videoMessage' : 'audioMessage';
            
            const newMessageContent = {
                [mediaType]: {
                    ...mediaObj,
                    caption: finalCaption
                }
            };

            const waMsg = generateWAMessageFromContent(targetJid, newMessageContent, {
                userJid: socket.user.id
            });

            await socket.relayMessage(targetJid, waMsg.message, { messageId: waMsg.key.id });
        } else {
            // NATIVE SERVER-SIDE INSTANT FORWARD (1-2 SECONDS FOR 1.5GB+ FILES)
            const quotedId = quotedInfo.stanzaId;
            const participant = quotedInfo.participant || sender;
            const botNumber = socket.user.id.split(':')[0];
            const isQuotedFromMe = participant.includes(botNumber);

            await socket.sendMessage(targetJid, { 
                forward: {
                    key: { 
                        remoteJid: msg.key.remoteJid, 
                        fromMe: isQuotedFromMe,
                        id: quotedId,
                        participant: msg.key.isGroup ? participant : undefined
                    },
                    message: quotedMsgObj
                }
            });
        }

        await socket.sendMessage(from, { 
            text: `⚡ *Forwarded Successfully in 1-2 Seconds!*\n\n🎯 *Target:* \`${targetJid}\`\n\n> ${DEFAULT_FOOTER}`
        }, { quoted: msg });
        
        await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('Forward command error:', error);
        await socket.sendMessage(from, { 
            text: `❌ *Forwarding Failed:* _${error.message}_\n\n> ${DEFAULT_FOOTER}`
        }, { quoted: msg });
    }
    break;
}

case 'cid':
case 'channelid':
case 'channeljid': {
    try {
        const input = (args[0] || '').trim();

        if (!input) {
            const prefixUsed = sessionConfig.PREFIX || config.PREFIX || '.';
            return await socket.sendMessage(sender, {
                text: `⚠️ *කරුණාකර WhatsApp Channel Link එක ලබා දෙන්න!*\n\n📝 *Format:* \`${prefixUsed}cid <channel_link>\` \n*Example:* \`${prefixUsed}cid https://whatsapp.com/channel/0029VbCi5BT5a23yioUIOp1w\``
            }, { quoted: msg });
        }

        if (!input.includes('whatsapp.com/channel/')) {
            return await socket.sendMessage(sender, {
                text: `❌ *Invalid Channel Link!* Karunakara valid WhatsApp Channel link ekak laba dennat.`
            }, { quoted: msg });
        }

        const inviteCode = input.split('whatsapp.com/channel/')[1].split('/')[0].split('?')[0];

        await socket.sendMessage(sender, { react: { text: '📢', key: msg.key } });

        const metadata = await socket.newsletterMetadata('invite', inviteCode).catch((err) => {
            console.error('Fetch channel metadata error:', err);
            return null;
        });

        if (!metadata) {
            return await socket.sendMessage(sender, {
                text: `❌ *Failed to fetch Channel details!* Make sure the channel link is valid.`
            }, { quoted: msg });
        }

        const channelName = metadata.name?.text || metadata.name || metadata.thread_metadata?.name?.text || metadata.thread_metadata?.name || metadata.subject || 'WhatsApp Channel';
        
        const rawSubs = metadata.subscribers || metadata.subscribers_count || metadata.thread_metadata?.subscribers_count || metadata.thread_metadata?.subscribers;
        const subscribers = rawSubs ? parseInt(rawSubs).toLocaleString() : 'N/A';
        
        const creationTime = metadata.creation_time || metadata.thread_metadata?.creation_time || metadata.created_at;
        const createdDate = creationTime ? new Date(parseInt(creationTime) * 1000).toLocaleString('en-US', { timeZone: 'Asia/Colombo' }) : 'N/A';
        
        const rawDesc = metadata.description?.text || metadata.description || metadata.thread_metadata?.description?.text || metadata.thread_metadata?.description || 'No description set.';
        const description = typeof rawDesc === 'string' ? rawDesc : (rawDesc?.text || 'No description set.');
        const trimmedDesc = description.length > 250 ? description.substring(0, 250) + '...' : description;

        let ppUrl = null;

        const picObj = metadata.picture || metadata.thread_metadata?.picture || metadata.preview || metadata.thread_metadata?.preview;
        if (picObj) {
            if (typeof picObj === 'string') ppUrl = picObj;
            else if (picObj.url) ppUrl = picObj.url;
            else if (picObj.direct_path) ppUrl = `https://pps.whatsapp.net${picObj.direct_path}`;
        }

        if (!ppUrl) {
            ppUrl = await socket.profilePictureUrl(metadata.id, 'image').catch(() => null);
        }
        if (!ppUrl) {
            ppUrl = await socket.profilePictureUrl(metadata.id, 'preview').catch(() => null);
        }

        let imageBuffer = null;
        if (ppUrl) {
            try {
                const imgRes = await axios.get(ppUrl, { responseType: 'arraybuffer', timeout: 10000 }).catch(() => null);
                if (imgRes && imgRes.data && imgRes.data.length > 0) {
                    imageBuffer = Buffer.from(imgRes.data);
                }
            } catch (e) {}
        }

        let infoCard = `*❪ 📢 WHATSAPP CHANNEL JID INFO ❫*\n\n` +
            `📢 *Channel Name:* _${channelName}_\n` +
            `🆔 *Channel JID:* \`${metadata.id}\`\n` +
            `👥 *Subscribers:* _${subscribers}_\n` +
            `📅 *Created Date:* _${createdDate}_\n\n` +
            `📝 *Description:*\n_${trimmedDesc}_\n\n` +
            `> 💡 _Tip: Copy the Channel JID above for \`.cmovie\` and \`.csong\` commands!_\n` +
            `> 🎭 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD 🎭`;

        if (imageBuffer) {
            await socket.sendMessage(sender, {
                image: imageBuffer,
                caption: infoCard
            }, { quoted: msg });
        } else if (ppUrl) {
            await socket.sendMessage(sender, {
                image: { url: ppUrl },
                caption: infoCard
            }, { quoted: msg });
        } else {
            const fallbackLogo = "https://chama-movie-api.koyeb.app/assets/chama_logo-K0qFVJ-7.png";
            await socket.sendMessage(sender, {
                image: { url: fallbackLogo },
                caption: infoCard
            }, { quoted: msg });
        }

        await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

    } catch (err) {
        console.error('cid command error:', err);
        await socket.sendMessage(sender, { text: `❌ *Error:* ${err.message}` }, { quoted: msg });
    }
    break;
}
case 'jid': {
    try {
        const input = args[0] || '';
        if (input.includes('whatsapp.com/channel/')) {
            const inviteCode = input.split('/').pop().split('?')[0];
            await socket.sendMessage(sender, { react: { text: "⏳", key: msg.key } });
            const metadata = await socket.newsletterMetadata('invite', inviteCode);
            await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });
            await socket.sendMessage(sender, { 
                text: `📢 *ᴄʜᴀɴɴᴇʟ ɴᴀᴍᴇ:* ${metadata.name}\n🆔 *ᴊɪᴅ:* \`${metadata.id}\`` 
            }, { quoted: msg });
        } else {
            const chatJid = msg.message.extendedTextMessage?.contextInfo?.participant || 
                            (args[0]?.includes('@') ? args[0] : (args[0] ? `${args[0].replace(/[^0-9]/g, '')}@s.whatsapp.net` : sender));
            await socket.sendMessage(sender, { text: chatJid }, { quoted: msg });
        }
    } catch (err) {
        console.error('Failed to get channel JID:', err);
        await socket.sendMessage(sender, { text: `❌ *Error:* ${err.message}` }, { quoted: msg });
    }
}
break;
case 'flow': {
    try {
        // Send a text fallback first so personal accounts can see and run the commands
        await socket.sendMessage(senderJid, {
            text: `💎 *💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD NATIVE FLOWS TESTER* 💎\n\n` +
                  `පහත කමාන්ඩ්ස් භාවිතයෙන් WhatsApp Native Flows Layouts ටෙස්ට් කළ හැක:\n\n` +
                  `📍 *Address Picker:* \`.flow_location\`\n` +
                  `📅 *Date Scheduler:* \`.flow_date\`\n` +
                  `📝 *Survey Feedback:* \`.flow_survey\`\n` +
                  `🛍️ *Shopping Cart:* \`.flow_cart\`\n` +
                  `📑 *Rules Accordion:* \`.flow_accordion\`\n` +
                  `📄 *HTML Code Viewer:* \`.code\`\n\n` +
                  `💡 _Note: WhatsApp Native Flows (Buttons) ක්‍රියා කරන්නේ WhatsApp Business ගිණුම් සඳහා පමණි._`
        }, { quoted: msg });

        await sendInteractiveMessage(socket, {
            jid: senderJid,
            header: "💎 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD NATIVE FLOWS TESTER 💎",
            text: "පහත බොත්තම් ක්ලික් කිරීමෙන් WhatsApp Native Flows Layouts ටෙස්ට් කර බැලිය හැක:",
            footer: "Select a Flow Layout below",
            buttons: [
                {
                    type: 'quick_reply',
                    text: '📍 Address Picker',
                    id: `${prefixUsed}flow_location`
                },
                {
                    type: 'quick_reply',
                    text: '📅 Date Scheduler',
                    id: `${prefixUsed}flow_date`
                },
                {
                    type: 'quick_reply',
                    text: '📝 Survey Feedback',
                    id: `${prefixUsed}flow_survey`
                },
                {
                    type: 'quick_reply',
                    text: '🛍️ Shopping Cart',
                    id: `${prefixUsed}flow_cart`
                },
                {
                    type: 'quick_reply',
                    text: '📑 Rules Accordion',
                    id: `${prefixUsed}flow_accordion`
                },
                {
                    type: 'quick_reply',
                    text: '📄 HTML Code Viewer',
                    id: `${prefixUsed}code`
                }
            ]
        }, { quoted: msg });
    } catch (e) {
        console.error(e);
    }
}
break;
case 'flow_location': {
    try {
        await sendInteractiveMessage(socket, {
            jid: senderJid,
            header: "📍 Address Picker Flow",
            text: "කරුණාකර පහත බොත්තමෙන් ඔබේ නිවැරදි ලිපිනය තෝරන්න:",
            footer: "💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD Native Location",
            buttons: [
                {
                    type: 'entry_point',
                    text: 'Select Location 📍',
                    id: '{"flow_id":"address_picker_flow_v2","screen":"LOCATION_SCREEN"}'
                }
            ]
        }, { quoted: msg });
    } catch (e) {
        console.error(e);
    }
}
break;
case 'flow_date': {
    try {
        await sendInteractiveMessage(socket, {
            jid: senderJid,
            header: "📅 Appointment Scheduler",
            text: "ඔබේ බොට් ගිණුම අලුත් කිරීමට අවශ්‍ය දිනය තෝරන්න:",
            footer: "💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD Scheduler",
            buttons: [
                {
                    type: 'entry_point',
                    text: 'Schedule Date 📅',
                    id: '{"flow_id":"date_picker_flow","screen":"SELECT_DATE_SCREEN"}'
                }
            ]
        }, { quoted: msg });
    } catch (e) {
        console.error(e);
    }
}
break;
case 'flow_survey': {
    try {
        await sendInteractiveMessage(socket, {
            jid: senderJid,
            header: "📝 Survey Feedback Sheet",
            text: "🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD ආරක්ෂාව සහ ක්‍රියාකාරිත්වය ගැන ඔබේ අදහස දක්වන්න:",
            footer: "🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD Survey",
            buttons: [
                {
                    type: 'entry_point',
                    text: 'Start Survey 📝',
                    id: '{"flow_id":"survey_feedback_flow","screen":"QUESTION_MAIN"}'
                }
            ]
        }, { quoted: msg });
    } catch (e) {
        console.error(e);
    }
}
break;
case 'rename': {
    try {
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
                          msg.message?.imageMessage?.contextInfo?.quotedMessage ||
                          msg.message?.videoMessage?.contextInfo?.quotedMessage ||
                          msg.message?.documentMessage?.contextInfo?.quotedMessage ||
                          msg.message?.audioMessage?.contextInfo?.quotedMessage;

        if (!quotedMsg) {
            return await socket.sendMessage(sender, {
                text: `⚠️ *කරුණාකර ඔබ Rename කිරීමට අවශ්‍ය File / Document / Media එකට Reply කර මෙම කමාන්ඩ් එක භාවිතා කරන්න.*\n\n📝 *Format 1:* \`.rename new_filename.mp4\`\n📝 *Format 2 (with Caption):* \`.rename new_filename.mp4 | Custom Caption Here\`\n\n📌 *Examples:*\n• \`.rename Avatar_2024.mp4\`\n• \`.rename Avatar_2024.mp4 | 🎬 Avatar (2024) 720p HD Subbed\``
            }, { quoted: msg });
        }

        const rawInput = args.join(' ').trim();
        if (!rawInput) {
            return await socket.sendMessage(sender, {
                text: `⚠️ *කරුණාකර අලුත් File නම ලබා දෙන්න!*\n\n📝 *Format 1:* \`.rename new_filename.mp4\`\n📝 *Format 2 (with Caption):* \`.rename new_filename.mp4 | Custom Caption Here\`\n\n📌 *Examples:*\n• \`.rename Avatar_2024.mp4\`\n• \`.rename Avatar_2024.mp4 | 🎬 Avatar (2024) 720p HD Subbed\``
            }, { quoted: msg });
        }

        // Split filename and optional custom caption using '|'
        const inputParts = rawInput.split('|');
        let newNameInput = inputParts[0].trim();
        let userCaption = inputParts.length > 1 ? inputParts.slice(1).join('|').trim() : null;

        const docMsg = quotedMsg.documentMessage || quotedMsg.documentWithCaptionMessage?.message?.documentMessage;
        const imgMsg = quotedMsg.imageMessage;
        const vidMsg = quotedMsg.videoMessage;
        const audMsg = quotedMsg.audioMessage;

        const mediaObj = docMsg || imgMsg || vidMsg || audMsg;

        if (!mediaObj) {
            return await socket.sendMessage(sender, {
                text: `❌ *ලබා දී ඇති Message එකෙහි File එකක් හමුවූයේ නැත. කරුණාකර වලංගු File / Document / Media එකකට Reply කරන්න.*`
            }, { quoted: msg });
        }

        await socket.sendMessage(sender, { react: { text: '⚡', key: msg.key } });

        let originalFileName = mediaObj.fileName || '';
        let mime = mediaObj.mimetype || 'application/octet-stream';

        let ext = '';
        const extMatch = originalFileName.match(/\.([a-zA-Z0-9]+)$/);
        if (extMatch) {
            ext = extMatch[0];
        } else {
            const mimeMap = {
                'application/pdf': '.pdf',
                'application/vnd.android.package-archive': '.apk',
                'application/zip': '.zip',
                'application/x-zip-compressed': '.zip',
                'application/x-rar-compressed': '.rar',
                'application/octet-stream': '.bin',
                'image/jpeg': '.jpg',
                'image/png': '.png',
                'image/webp': '.webp',
                'video/mp4': '.mp4',
                'video/mkv': '.mkv',
                'audio/mpeg': '.mp3',
                'audio/mp4': '.m4a',
                'audio/ogg': '.ogg',
                'text/plain': '.txt'
            };
            ext = mimeMap[mime] || '';
        }

        const hasExtension = /\.[a-zA-Z0-9]+$/.test(newNameInput);
        const finalFileName = hasExtension ? newNameInput : (newNameInput + ext);
        const DEFAULT_FOOTER = sessionConfig.BOT_FOOTER || config.BOT_FOOTER || '💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD BOT';
        
        const captionText = userCaption 
            ? `${userCaption}\n\n> ${DEFAULT_FOOTER}`
            : `📄 *FILE RENAMED SUCCESSFUL*\n\n📝 *File Name:* \`${finalFileName}\`\n\n> ${DEFAULT_FOOTER}`;

        // INSTANT ZERO-DOWNLOAD RELAY LOGIC (ULTRA SPEED)
        if (mediaObj.url && mediaObj.mediaKey) {
            const newMessageContent = {
                documentMessage: {
                    ...mediaObj,
                    fileName: finalFileName,
                    caption: captionText,
                    mimetype: mime
                }
            };

            const waMsg = generateWAMessageFromContent(sender, newMessageContent, {
                userJid: socket.user.id,
                quoted: msg
            });

            await socket.relayMessage(sender, waMsg.message, { messageId: waMsg.key.id });
            await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
            return;
        }

        // FALLBACK DOWNLOAD IF CDN POINTER IS EXPIRED
        let mediaType = docMsg ? 'document' : imgMsg ? 'image' : vidMsg ? 'video' : 'audio';
        const stream = await downloadContentFromMessage(mediaObj, mediaType);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        await socket.sendMessage(sender, {
            document: buffer,
            mimetype: mime,
            fileName: finalFileName,
            caption: captionText
        }, { quoted: msg });

        await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

    } catch (err) {
        console.error('Rename command error:', err);
        await socket.sendMessage(sender, {
            text: `❌ *Rename Error:* ${err.message}`
        }, { quoted: msg });
    }
}
break;

case 'cmovie':
case 'cfv':
case 'cfile': {
    const from = sender;
    try {
        const targetJidInput = args[0];

        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
                          msg.message?.imageMessage?.contextInfo?.quotedMessage ||
                          msg.message?.videoMessage?.contextInfo?.quotedMessage ||
                          msg.message?.documentMessage?.contextInfo?.quotedMessage ||
                          msg.message?.audioMessage?.contextInfo?.quotedMessage;

        if (!targetJidInput) {
            return await socket.sendMessage(from, {
                text: `⚠️ *Invalid Usage!*\n\n📝 *Format 1 (Reply Mode):* Reply to a movie/file with \`.cmovie <targetJid / channel_link> [new title]\`\n📝 *Format 2 (Search Mode):* \`.cmovie <targetJid / channel_link> <movie name>\`\n\n*Examples:*\n• Reply to a file: \`.cmovie 120363408929003946@g.us Avatar.mp4\`\n• Search & Forward: \`.cmovie 120363408929003946@g.us avatar\``
            }, { quoted: msg });
        }

        const extractMessageText = (m) => {
            if (!m || !m.message) return '';
            let msg = m.message;
            if (msg.ephemeralMessage) msg = msg.ephemeralMessage.message || msg;
            if (msg.viewOnceMessage) msg = msg.viewOnceMessage.message || msg;
            if (msg.viewOnceMessageV2) msg = msg.viewOnceMessageV2.message || msg;
            if (msg.documentWithCaptionMessage) msg = msg.documentWithCaptionMessage.message || msg;

            return (
                msg.conversation ||
                msg.extendedTextMessage?.text ||
                msg.imageMessage?.caption ||
                msg.videoMessage?.caption ||
                msg.documentMessage?.caption ||
                msg.buttonsResponseMessage?.selectedButtonId ||
                msg.templateButtonReplyMessage?.selectedId ||
                msg.listResponseMessage?.singleSelectReply?.selectedRowId ||
                ''
            ).trim();
        };

        const waitForReply = (chatJid, filterFn, timeoutMs = 180000) => {
            return new Promise((resolve) => {
                const handler = (update) => {
                    const m = update.messages[0];
                    if (!m || !m.message) return;
                    if (m.key.remoteJid !== chatJid) return;
                    const body = extractMessageText(m);
                    let msgObj = m.message;
                    if (msgObj.ephemeralMessage) msgObj = msgObj.ephemeralMessage.message || msgObj;
                    const quotedId = msgObj?.extendedTextMessage?.contextInfo?.stanzaId || msgObj?.imageMessage?.contextInfo?.stanzaId;
                    if (filterFn(body, quotedId, m)) {
                        socket.ev.off('messages.upsert', handler);
                        clearTimeout(timer);
                        resolve({ m, body, quotedId });
                    }
                };
                const timer = setTimeout(() => {
                    socket.ev.off('messages.upsert', handler);
                    resolve(null);
                }, timeoutMs);
                socket.ev.on('messages.upsert', handler);
            });
        };

        // Mode 2: Multi-Site Search & Forward if NOT replying to a message
        if (!quotedMsg) {
            const movieQuery = args.slice(1).join(' ').trim();
            if (!movieQuery) {
                return await socket.sendMessage(from, {
                    text: `⚠️ *කරුණාකර සොයන Movie නම ලබා දෙන්න!*\n\n📝 *Format:* \`.cmovie <target_jid> <movie_name>\`\n*Example:* \`.cmovie 120363408929003946@g.us avatar\``
                }, { quoted: msg });
            }

            let targetJid = targetJidInput;
            if (targetJid === '.' || targetJid.toLowerCase() === 'here') {
                targetJid = from;
            } else if (targetJid.includes('whatsapp.com/channel/')) {
                const inviteCode = targetJid.split('whatsapp.com/channel/')[1].split('/')[0].split('?')[0];
                try {
                    const metadata = await socket.newsletterMetadata('invite', inviteCode);
                    targetJid = metadata.id;
                } catch (err) {
                    return await socket.sendMessage(from, { text: `❌ *Failed to resolve Channel link:* _${err.message}_` }, { quoted: msg });
                }
            } else if (!targetJid.includes('@')) {
                if (/^\d{12,}$/.test(targetJid)) targetJid = `${targetJid}@newsletter`;
                else targetJid = `${targetJid.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
            }

            const API_BASE = "https://chama-movie-api.koyeb.app";
            const API_KEY = "chama_api_23c3e7ffb034f25cf474f6d7ac266f9b";

            const siteMenuText = `*❪ SELECT MOVIE SOURCE / SITE ❫*

🔍 *Movie Query:* _${movieQuery}_
🎯 *Target Chat:* \`${targetJid}\`

*01* ➜ 🎬 CINESUBZ
*02* ➜ 🎬 SINHALASUB
*03* ➜ 🎬 THENKIRI
*04* ➜ 🎬 MOVIESUBLK
*05* ➜ 🎬 BAISCOPE
*06* ➜ 🎬 CINERU
*07* ➜ 🎬 MOVIEBOX
*08* ➜ 🌐 ALL SITES (SEARCH ALL)

*👇 REPLY WITH A NUMBER (1-8) TO CHOOSE SITE 👇*

> 💎 𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘 CINE HUB 💎`;

            const siteMenuMsg = await socket.sendMessage(from, { text: siteMenuText }, { quoted: msg });

            const siteReply = await waitForReply(from, (body) => {
                const num = parseInt(body);
                return !isNaN(num) && num >= 1 && num <= 8;
            });
            if (!siteReply) return;

            const siteChoiceNum = parseInt(siteReply.body);
            await socket.sendMessage(from, { react: { text: '🔍', key: siteReply.m.key } });

            const siteMap = {
                1: ['cinesubz'],
                2: ['sinhalasub'],
                3: ['thenkiri'],
                4: ['moviesublk'],
                5: ['baiscope'],
                6: ['cineru'],
                7: ['moviebox'],
                8: ['cinesubz', 'sinhalasub', 'thenkiri', 'moviesublk', 'baiscope', 'cineru', 'moviebox']
            };

            const selectedSites = siteMap[siteChoiceNum];
            const siteLabel = siteChoiceNum === 8 ? "ALL SITES" : selectedSites[0].toUpperCase();

            await socket.sendMessage(from, { text: `🔍 *Searching "${movieQuery}" on ${siteLabel}...*\n⚡ _Please wait a moment..._` }, { quoted: siteReply.m });

            const promises = selectedSites.map(site => 
                axios.get(`${API_BASE}/api/v1/movie/${site}/search?q=${encodeURIComponent(movieQuery)}&api_key=${API_KEY}`)
                    .then(res => res.data.status && res.data.data ? res.data.data.map(item => ({ ...item, site })) : [])
                    .catch(() => [])
            );

            const resultsArrays = await Promise.all(promises);
            let results = [];
            const maxLen = Math.max(...resultsArrays.map(arr => arr.length), 0);
            for (let i = 0; i < maxLen; i++) {
                for (const arr of resultsArrays) {
                    if (i < arr.length) results.push(arr[i]);
                }
            }
            results = results.slice(0, 30);

            if (results.length === 0) {
                return await socket.sendMessage(from, {
                    text: `❌ *No movie results found on ${siteLabel} for:* _${movieQuery}_`
                }, { quoted: siteReply.m });
            }

            let listText = `*❪ MOVIE SEARCH RESULTS (${siteLabel}) ❫*\n\n🔍 *Movie Query:* _${movieQuery}_\n🎯 *Target Chat:* \`${targetJid}\`\n📊 *Results Found:* ${results.length}\n\n*👇 REPLY WITH NUMBER TO SEND TO TARGET 👇*\n\n`;

            results.forEach((item, index) => {
                const siteTag = item.site.toUpperCase();
                const typeIcon = item.type === 'tvshows' ? '📺' : '🎥';
                const num = (index + 1) < 10 ? `0${index + 1}` : `${index + 1}`;
                listText += `*${num}* ➜ ${typeIcon} [_${siteTag}_] _${item.title.substring(0, 35)}_\n`;
            });

            listText += `\n> 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘 CINE HUB 💎`;

            const searchListMsg = await socket.sendMessage(from, { text: listText }, { quoted: siteReply.m });

            const movieReply = await waitForReply(from, (body) => {
                const choice = parseInt(body) - 1;
                return !isNaN(choice) && choice >= 0 && choice < results.length;
            });
            if (!movieReply) return;

            const choice = parseInt(movieReply.body) - 1;
            const selectedItem = results[choice];
            const site = selectedItem.site;
            let mm = movieReply.m;

            await socket.sendMessage(from, { react: { text: '⏳', key: mm.key } });
            await socket.sendMessage(from, { text: `🎬 *Fetching Quality Options from ${site.toUpperCase()}...*\n⚡ _Please wait a moment..._` }, { quoted: mm });

            try {
                const infoEndpoint = site === 'moviebox' ? 'info' : 'infodl';
                const detailsResponse = await axios.get(`${API_BASE}/api/v1/movie/${site}/${infoEndpoint}?q=${encodeURIComponent(selectedItem.link)}&api_key=${API_KEY}`);
                const movieInfo = detailsResponse.data?.data || {};
                let validDownloads = movieInfo?.downloads || [];
                const episodes = movieInfo?.episodes || detailsResponse.data?.episodes || [];

                // TV Series Options Flow
                if ((!validDownloads || validDownloads.length === 0) && episodes && episodes.length > 0) {
                    let modeText = `*❪ TV SERIES DOWNLOAD OPTIONS ❫*\n\n📺 *TV Series:* _${movieInfo?.title || selectedItem.title}_\n🎯 *Target Chat:* \`${targetJid}\`\n🗿 *Source Site:* ${site.toUpperCase()}\n📊 *Total Episodes:* ${episodes.length}\n\n*1️⃣* ➜ 📦 *DOWNLOAD ALL EPISODES (BULK)*\n*2️⃣* ➜ 🎬 *SELECT SINGLE EPISODE*\n\n*👇 REPLY WITH A NUMBER (1 OR 2) 👇*\n\n> 🎭 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘 CINE HUB 🎭`;

                    const modeMsg = await socket.sendMessage(from, { text: modeText }, { quoted: mm });
                    const modeReply = await waitForReply(from, (body) => ['1', '2'].includes(body));
                    if (!modeReply) return;

                    mm = modeReply.m;

                    if (modeReply.body === '1') {
                        // Bulk Mode Quality Selection
                        await socket.sendMessage(from, { react: { text: '⏳', key: mm.key } });
                        await socket.sendMessage(from, { text: `🎬 *Fetching Bulk Quality Options from ${site.toUpperCase()}...*\n⚡ _Please wait a moment..._` }, { quoted: mm });

                        let bulkDlOptions = [];
                        try {
                            const ep1Url = episodes[0].episode_url || episodes[0].url || episodes[0].link;
                            const ep1Res = await axios.get(`${API_BASE}/api/v1/movie/${site}/${infoEndpoint}?q=${encodeURIComponent(ep1Url)}&api_key=${API_KEY}`);
                            const ep1Data = ep1Res.data?.data;
                            const ep1Dls = Array.isArray(ep1Data) ? ep1Data : (ep1Data?.downloads || ep1Res.data?.downloads || []);
                            const videoEp1Dls = ep1Dls.filter(d => d.quality !== 'SUB' && !d.title?.toLowerCase().includes('subtitle') && !d.name?.toLowerCase().includes('subtitle'));
                            bulkDlOptions = videoEp1Dls.length > 0 ? videoEp1Dls : ep1Dls;
                        } catch (ep1Err) {
                            console.error('[Bulk Quality Fetch Error]:', ep1Err.message);
                        }

                        let chosenQualityIndex = 0;
                        if (bulkDlOptions && bulkDlOptions.length > 0) {
                            let bulkQText = `*❪ CHOOSE BULK EPISODES QUALITY ❫*\n\n📺 *TV Series:* _${movieInfo?.title || selectedItem.title}_\n🎯 *Target Chat:* \`${targetJid}\`\n🗿 *Source Site:* ${site.toUpperCase()}\n📊 *Total Episodes:* ${episodes.length}\n\n*👇 SELECT A QUALITY NUMBER FOR ALL EPISODES 👇*\n\n`;

                            bulkDlOptions.forEach((dl, idx) => {
                                const num = (idx + 1) < 10 ? `0${idx + 1}` : `${idx + 1}`;
                                const qName = dl.quality || dl.name || dl.title || `Quality ${idx + 1}`;
                                const fSize = dl.size || dl.filesize || 'N/A';
                                bulkQText += `*${num}* ➜ 🎬 *${qName}* _(Per Ep ~${fSize})_\n`;
                            });

                            bulkQText += `\n> 🎭 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘 CINE HUB 🎭`;

                            const bulkQMsg = await socket.sendMessage(from, { text: bulkQText }, { quoted: mm });
                            const bulkQReply = await waitForReply(from, (body) => {
                                const choice = parseInt(body) - 1;
                                return !isNaN(choice) && choice >= 0 && choice < bulkDlOptions.length;
                            });

                            if (!bulkQReply) return;
                            mm = bulkQReply.m;
                            chosenQualityIndex = parseInt(bulkQReply.body) - 1;
                        }

                        const chosenQualityLabel = bulkDlOptions[chosenQualityIndex]?.quality || bulkDlOptions[chosenQualityIndex]?.name || bulkDlOptions[chosenQualityIndex]?.title || 'Selected Quality';

                        await socket.sendMessage(from, { text: `📦 *Starting Auto Bulk Download of ALL ${episodes.length} Episodes (${chosenQualityLabel})...*\n⚡ _Sending details and video files to Target Chat in background!_` }, { quoted: mm });

                        (async () => {
                            const posterUrl = movieInfo.image || selectedItem.image || "https://chama-movie-api.koyeb.app/assets/chama_logo-K0qFVJ-7.png";
                            const seriesTitle = movieInfo.title || selectedItem.title;
                            const tvDetailsText = `*❪ TV SERIES DETAILS ❫*\n\n📺 *${seriesTitle}*\n⭐ *IMDB* ➜ ★ ${movieInfo.imdb || movieInfo.rating || 'N/A'}\n📅 *Year* ➜ ${movieInfo.year || 'N/A'}\n📊 *Total Episodes* ➜ ${episodes.length}\n🗿 *Source Site* ➜ ${site.toUpperCase()}\n📝 *Story* ➜ ${movieInfo.story ? (movieInfo.story.length > 250 ? movieInfo.story.substring(0, 250) + '...' : movieInfo.story) : 'N/A'}\n\n> 🎭 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘 CINE HUB 🎭`;
                            await socket.sendMessage(targetJid, { image: { url: posterUrl }, caption: tvDetailsText }).catch(() => {});

                            for (let i = 0; i < episodes.length; i++) {
                                const ep = episodes[i];
                                const epName = ep.episode_name || ep.name || ep.title || `Episode ${i + 1}`;
                                const epUrl = ep.episode_url || ep.url || ep.link;

                                try {
                                    const epRes = await axios.get(`${API_BASE}/api/v1/movie/${site}/${infoEndpoint}?q=${encodeURIComponent(epUrl)}&api_key=${API_KEY}`);
                                    const epData = epRes.data?.data;
                                    const epDls = Array.isArray(epData) ? epData : (epData?.downloads || epRes.data?.downloads || []);
                                    if (epDls.length > 0) {
                                        const nonSubDls = epDls.filter(d => d.quality !== 'SUB' && !d.title?.toLowerCase().includes('subtitle') && !d.name?.toLowerCase().includes('subtitle'));
                                        const validEpDls = nonSubDls.length > 0 ? nonSubDls : epDls;
                                        
                                        const selectedDlObj = validEpDls[chosenQualityIndex] || validEpDls[0];
                                        const dlUrl = selectedDlObj.link || selectedDlObj.url;
                                        const quality = selectedDlObj.quality || selectedDlObj.size || chosenQualityLabel;
                                        const fileName = `${seriesTitle} - ${epName} (${quality}).mp4`;

                                        let sent = false;
                                        try {
                                            await socket.sendMessage(targetJid, { document: { url: dlUrl }, mimetype: 'video/mp4', fileName, caption: `🎬 *${seriesTitle}*\n📌 *${epName}*\n📊 *Quality:* ${quality}\n\n> 🎭 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘 CINE HUB 🎭` });
                                            sent = true;
                                        } catch (e1) {
                                            const tempFile = `./temp_ep_${Date.now()}.mp4`;
                                            try {
                                                const dlCmd = `yt-dlp --no-playlist --no-check-certificates -o "${tempFile}" "${dlUrl}"`;
                                                await new Promise((r, j) => exec(dlCmd, { timeout: 180000 }, err => (!err && fs.existsSync(tempFile)) ? r() : j(err)));
                                                await socket.sendMessage(targetJid, { document: { url: tempFile }, mimetype: 'video/mp4', fileName, caption: `🎬 *${seriesTitle}*\n📌 *${epName}*\n📊 *Quality:* ${quality}\n\n> 🎭 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘 CINE HUB 🎭` });
                                                sent = true;
                                            } catch (e2) {} finally { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); }
                                        }
                                        if (!sent) await socket.sendMessage(targetJid, { text: `📌 *${epName}* (${quality}) Direct Link:\n${dlUrl}` });
                                    }
                                } catch (epErr) {
                                    console.error(`Bulk ep ${i+1} err:`, epErr.message);
                                }
                            }
                        })().catch(console.error);
                        return;
                    }

                    // Single Episode Mode
                    let epText = `*❪ SELECT TV SERIES EPISODE ❫*\n\n📺 *TV Series:* _${movieInfo?.title || selectedItem.title}_\n🎯 *Target Chat:* \`${targetJid}\`\n🗿 *Source Site:* ${site.toUpperCase()}\n📊 *Total Episodes:* ${episodes.length}\n\n*👇 REPLY WITH EPISODE NUMBER (1-${episodes.length}) 👇*\n\n`;
                    episodes.forEach((ep, idx) => {
                        const num = (idx + 1) < 10 ? `0${idx + 1}` : `${idx + 1}`;
                        const epName = ep.episode_name || ep.name || ep.title || `Episode ${idx + 1}`;
                        epText += `*${num}* ➜ 📺 *${epName}*\n`;
                    });
                    epText += `\n> 🎭 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘 CINE HUB 🎭`;

                    const epMenuMsg = await socket.sendMessage(from, { text: epText }, { quoted: mm });
                    const epReply = await waitForReply(from, (body) => {
                        const num = parseInt(body) - 1;
                        return !isNaN(num) && num >= 0 && num < episodes.length;
                    });
                    if (!epReply) return;

                    mm = epReply.m;
                    const selectedEp = episodes[parseInt(epReply.body) - 1];
                    const epUrl = selectedEp.episode_url || selectedEp.url || selectedEp.link;

                    await socket.sendMessage(from, { react: { text: '⏳', key: mm.key } });
                    await socket.sendMessage(from, { text: `🎬 *Fetching Episode Quality Options from ${site.toUpperCase()}...*\n⚡ _Please wait a moment..._` }, { quoted: mm });

                    try {
                        const epDetailsRes = await axios.get(`${API_BASE}/api/v1/movie/${site}/${infoEndpoint}?q=${encodeURIComponent(epUrl)}&api_key=${API_KEY}`);
                        const epData = epDetailsRes.data?.data;
                        validDownloads = Array.isArray(epData) ? epData : (epData?.downloads || epDetailsRes.data?.downloads || []);
                        if (selectedEp.episode_name || selectedEp.name || selectedEp.title) {
                            const epTitleName = selectedEp.episode_name || selectedEp.name || selectedEp.title;
                            movieInfo.title = `${movieInfo.title || selectedItem.title} - ${epTitleName}`;
                        }
                    } catch (epFetchErr) {
                        console.error('[TV Episode Fetch Error]:', epFetchErr.message);
                    }
                }

                if (!validDownloads || validDownloads.length === 0) {
                    await socket.sendMessage(from, { text: `❌ *No download links found for this item!*` }, { quoted: mm });
                    return;
                }

                const videoDls = validDownloads.filter(d => d.quality !== 'SUB' && !d.title?.toLowerCase().includes('subtitle') && !d.name?.toLowerCase().includes('subtitle'));
                const dlOptions = videoDls.length > 0 ? videoDls : validDownloads;
                const posterUrl = movieInfo.image || selectedItem.image || "https://chama-movie-api.koyeb.app/assets/chama_logo-K0qFVJ-7.png";
                const movieTitle = movieInfo.title || selectedItem.title;

                // Step 4: Quality Menu & Download
                let qText = `*❪ CHOOSE MOVIE QUALITY ❫*\n\n🎬 *Movie:* _${movieTitle}_\n🎯 *Target Chat:* \`${targetJid}\`\n🗿 *Source Site:* ${site.toUpperCase()}\n\n*👇 SELECT A QUALITY NUMBER 👇*\n\n`;
                dlOptions.forEach((dl, idx) => {
                    const num = (idx + 1) < 10 ? `0${idx + 1}` : `${idx + 1}`;
                    const qName = dl.quality || dl.name || dl.title || `Quality ${idx + 1}`;
                    const fSize = dl.size || dl.filesize || 'N/A';
                    qText += `*${num}* ➜ 🎬 *${qName}* _(${fSize})_\n`;
                });
                qText += `\n> 🎭 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘 CINE HUB 🎭`;

                const qMenuMsg = await socket.sendMessage(from, { text: qText }, { quoted: mm });
                const qReply = await waitForReply(from, (body) => {
                    const choice = parseInt(body) - 1;
                    return !isNaN(choice) && choice >= 0 && choice < dlOptions.length;
                });
                if (!qReply) return;

                const qm = qReply.m;
                const qChoice = parseInt(qReply.body) - 1;
                const selectedDl = dlOptions[qChoice];
                const dlQuality = selectedDl.quality || selectedDl.name || selectedDl.title || 'HD';
                const currentDlUrl = selectedDl.link || selectedDl.url;

                await socket.sendMessage(from, { react: { text: '⏳', key: qm.key } });
                await socket.sendMessage(from, { text: `🎬 *Sending Movie (${dlQuality}) to Target Chat...*\n⚡ _Movie uploading in background. You can send other commands freely!_` }, { quoted: qm });

                (async () => {
                    try {
                        const movieDetailsText = `*❪ MOVIE DETAILS ❫*\n\n🎬 *${movieTitle}*\n⭐ *IMDB* ➜ ★ ${movieInfo.imdb || movieInfo.rating || 'N/A'}\n📅 *Year* ➜ ${movieInfo.year || 'N/A'}\n⏳ *Duration* ➜ ${movieInfo.duration || 'N/A'}\n🌍 *Country* ➜ ${movieInfo.country || 'N/A'}\n🎭 *Genres* ➜ ${movieInfo.genres ? (Array.isArray(movieInfo.genres) ? movieInfo.genres.join(', ') : movieInfo.genres) : 'N/A'}\n🏷️ *Language* ➜ ${movieInfo.language || movieInfo.tag || 'N/A'}\n🎬 *Director* ➜ ${movieInfo.directors || movieInfo.director || 'N/A'}\n🗿 *Source Site* ➜ ${site.toUpperCase()}\n📝 *Story* ➜ ${movieInfo.story ? (movieInfo.story.length > 250 ? movieInfo.story.substring(0, 250) + '...' : movieInfo.story) : 'N/A'}\n\n> 🎭 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘 CINE HUB 🎭\n> 🧬 ᴘᴏᴡᴇʀᴇᴅ ʙʏ 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD`;

                        await socket.sendMessage(targetJid, { image: { url: posterUrl }, caption: movieDetailsText });

                        let uploadSuccess = false;
                        const dlFileName = `${movieTitle} (${dlQuality}).mp4`;

                        if (currentDlUrl) {
                            try {
                                await socket.sendMessage(targetJid, {
                                    document: { url: currentDlUrl },
                                    mimetype: 'video/mp4',
                                    fileName: dlFileName,
                                    caption: `🎬 *${movieTitle}*\n📊 *Quality:* ${dlQuality}\n📁 *File:* ${dlFileName}\n\n> 🎭 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘 CINE HUB 🎭`
                                });
                                uploadSuccess = true;
                            } catch (err1) {
                                try {
                                    const streamRes = await axios.get(currentDlUrl, {
                                        responseType: 'stream',
                                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept': '*/*' },
                                        timeout: 120000
                                    });
                                    await socket.sendMessage(targetJid, {
                                        document: { stream: streamRes.data },
                                        mimetype: 'video/mp4',
                                        fileName: dlFileName,
                                        caption: `🎬 *${movieTitle}*\n📊 *Quality:* ${dlQuality}\n📁 *File:* ${dlFileName}\n\n> 🎭 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘 CINE HUB ♞`
                                    });
                                    uploadSuccess = true;
                                } catch (err2) {}
                            }
                        }

                        if (!uploadSuccess && currentDlUrl) {
                            const tempFilePath = `./temp_dl_${Date.now()}.mp4`;
                            try {
                                const downloadCmd = `yt-dlp --no-playlist --no-check-certificates --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" -o "${tempFilePath}" "${currentDlUrl}"`;
                                await new Promise((res, rej) => {
                                    exec(downloadCmd, { timeout: 180000 }, (err) => {
                                        if (!err && fs.existsSync(tempFilePath) && fs.statSync(tempFilePath).size > 1000) res();
                                        else rej(err || new Error('Temp file download failed'));
                                    });
                                });

                                await socket.sendMessage(targetJid, {
                                    document: { url: tempFilePath },
                                    mimetype: 'video/mp4',
                                    fileName: dlFileName,
                                    caption: `🎬 *${movieTitle}*\n📊 *Quality:* ${dlQuality}\n📁 *File:* ${dlFileName}\n\n> 🎭 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘 CINE HUB 🍃`
                                });
                                uploadSuccess = true;
                            } catch (err3) {} finally {
                                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
                            }
                        }

                        if (uploadSuccess) {
                            await socket.sendMessage(from, { text: `✅ *Movie Details & Video File (${dlQuality}) successfully sent to Target Chat!*\n\n🎯 *Target:* \`${targetJid}\`\n🎬 *Title:* \`${movieTitle}\`` }, { quoted: qm });
                            await socket.sendMessage(from, { react: { text: '✅', key: qm.key } });
                        } else {
                            let dlLinksText = `⚠️ *Direct Video File Upload Restricted by Host*\n\n🎬 *${movieTitle}*\n📌 *Quality:* ${dlQuality}\n📁 *Size:* ${selectedDl.size || 'N/A'}\n\n🔗 *Direct Download Link:*\n➜ ${currentDlUrl}\n\n> 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘 CINE HUB 🧚‍♂️`;
                            await socket.sendMessage(targetJid, { text: dlLinksText });
                            await socket.sendMessage(from, { text: `⚠️ *Video File upload to WhatsApp failed due to host restrictions, but Direct Download Link was sent to Target Chat!` }, { quoted: qm });
                            await socket.sendMessage(from, { react: { text: '⚠️', key: qm.key } });
                        }
                    } catch (err) {
                        await socket.sendMessage(from, { text: `❌ *Failed to fetch/send movie:* ${err.message}` }, { quoted: qm });
                    }
                })().catch(console.error);
                return;
            } catch (err) {
                console.error("Movie details error:", err);
                return await socket.sendMessage(from, { text: `❌ *Failed to fetch details:* ${err.message}` }, { quoted: msg });
            }
        }

        // Mode 1: Instant Reply Forward Mode
        const newFileNameInput = args.slice(1).join(' ').trim();
        let targetJid = targetJidInput;
        if (targetJid === '.' || targetJid.toLowerCase() === 'here') {
            targetJid = from;
        } else if (targetJid.includes('whatsapp.com/channel/')) {
            const inviteCode = targetJid.split('whatsapp.com/channel/')[1].split('/')[0].split('?')[0];
            try {
                const metadata = await socket.newsletterMetadata('invite', inviteCode);
                targetJid = metadata.id;
            } catch (err) {
                return await socket.sendMessage(from, { text: `❌ *Failed to resolve Channel from link:* _${err.message}_` }, { quoted: msg });
            }
        } else if (!targetJid.includes('@')) {
            if (/^\d{12,}$/.test(targetJid)) targetJid = `${targetJid}@newsletter`;
            else targetJid = `${targetJid.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
        }

        const docMsg = quotedMsg.documentMessage || quotedMsg.documentWithCaptionMessage?.message?.documentMessage;
        const imgMsg = quotedMsg.imageMessage;
        const vidMsg = quotedMsg.videoMessage;
        const audMsg = quotedMsg.audioMessage;

        const mediaObj = docMsg || imgMsg || vidMsg || audMsg;
        if (!mediaObj) {
            return await socket.sendMessage(from, { text: `❌ *No media file found in replied message!*` }, { quoted: msg });
        }
    } catch (err) {
        console.error('cmovie command error:', err);
        await socket.sendMessage(sender, { text: `❌ *Forward Error:* ${err.message}` }, { quoted: msg });
    }
}
break;
case 'catbox':
case 'tourl':
case 'url':
case 'upload':
case 'imgbb': {
    const from = sender;
    try {
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
                          msg.message?.imageMessage?.contextInfo?.quotedMessage ||
                          msg.message?.videoMessage?.contextInfo?.quotedMessage ||
                          msg.message?.documentMessage?.contextInfo?.quotedMessage ||
                          msg.message?.audioMessage?.contextInfo?.quotedMessage ||
                          msg.message?.stickerMessage?.contextInfo?.quotedMessage;

        const directMediaObj = msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.documentMessage || msg.message?.audioMessage || msg.message?.stickerMessage;

        const targetMsg = quotedMsg || (directMediaObj ? msg.message : null);

        if (!targetMsg) {
            return await socket.sendMessage(from, {
                text: '⚠️ *කරුණාකර Upload කිරීමට අවශ්‍ය Image, Video, Audio, Document හෝ Sticker එකකට Reply කර `.tourl` / `.catbox` ලෙස යොමු කරන්න!*'
            }, { quoted: msg });
        }

        const docMsg = targetMsg.documentMessage || targetMsg.documentWithCaptionMessage?.message?.documentMessage;
        const imgMsg = targetMsg.imageMessage;
        const vidMsg = targetMsg.videoMessage;
        const audMsg = targetMsg.audioMessage;
        const stkMsg = targetMsg.stickerMessage;

        const mediaObj = docMsg || imgMsg || vidMsg || audMsg || stkMsg;

        if (!mediaObj) {
            return await socket.sendMessage(from, { text: '❌ *No valid media file found to upload!*' }, { quoted: msg });
        }

        await socket.sendMessage(from, { react: { text: '⏳', key: msg.key } });

        let originalFileName = mediaObj.fileName || 'file';
        let mime = mediaObj.mimetype || 'application/octet-stream';

        let ext = '';
        const extMatch = originalFileName.match(/\.([a-zA-Z0-9]+)$/);
        if (extMatch) {
            ext = extMatch[0];
        } else {
            const mimeMap = {
                'image/jpeg': '.jpg',
                'image/png': '.png',
                'image/webp': '.webp',
                'video/mp4': '.mp4',
                'audio/mpeg': '.mp3',
                'audio/ogg': '.ogg',
                'application/pdf': '.pdf',
                'application/vnd.android.package-archive': '.apk',
                'application/zip': '.zip'
            };
            ext = mimeMap[mime] || '.bin';
        }

        const finalFileName = originalFileName.includes('.') ? originalFileName : (originalFileName + ext);
        let mediaType = docMsg ? 'document' : imgMsg ? 'image' : vidMsg ? 'video' : audMsg ? 'audio' : 'sticker';

        // Download media stream into Buffer
        const stream = await downloadContentFromMessage(mediaObj, mediaType);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        if (!buffer || buffer.length === 0) {
            return await socket.sendMessage(from, { text: '❌ *Failed to download media buffer for upload!*' }, { quoted: msg });
        }

        const imgbbKey = process.env.IMGBB_API_KEY || '';
        const urls = {};

        // 1. Catbox.moe Permanent Host
        const pCatbox = (async () => {
            try {
                const form = new FormData();
                form.append('reqtype', 'fileupload');
                form.append('fileToUpload', new Blob([buffer], { type: mime || 'image/jpeg' }), finalFileName);
                const res = await fetch('https://catbox.moe/user/api.php', {
                    method: 'POST',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                        'Origin': 'https://catbox.moe',
                        'Referer': 'https://catbox.moe/'
                    },
                    body: form
                });
                const text = (await res.text()).trim();
                if (text && text.startsWith('http')) urls.catbox = text;
            } catch (e) {
                console.error('Catbox upload error:', e.message);
            }
        })();

        // 2. Qu.ax Direct Host
        const pQuax = (async () => {
            try {
                const form = new FormData();
                form.append('files[]', new Blob([buffer], { type: mime || 'image/jpeg' }), finalFileName);
                const res = await fetch('https://qu.ax/upload.php', {
                    method: 'POST',
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' },
                    body: form
                });
                const json = await res.json();
                if (json && json.success && json.files?.[0]?.url) urls.quax = json.files[0].url;
            } catch (e) {
                console.error('Qu.ax upload error:', e.message);
            }
        })();

        // 3. Litterbox (Catbox 72H Host)
        const pLitterbox = (async () => {
            try {
                const form = new FormData();
                form.append('reqtype', 'fileupload');
                form.append('time', '72h');
                form.append('fileToUpload', new Blob([buffer], { type: mime || 'image/jpeg' }), finalFileName);
                const res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
                    method: 'POST',
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' },
                    body: form
                });
                const text = (await res.text()).trim();
                if (text && text.startsWith('http')) urls.litterbox = text;
            } catch (e) {
                console.error('Litterbox upload error:', e.message);
            }
        })();

        // 4. Tmpfiles.org Direct Host
        const pTmpfiles = (async () => {
            try {
                const form = new FormData();
                form.append('file', new Blob([buffer], { type: mime || 'image/jpeg' }), finalFileName);
                const res = await fetch('https://tmpfiles.org/api/v1/upload', {
                    method: 'POST',
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' },
                    body: form
                });
                const json = await res.json();
                if (json && json.status === 'success' && json.data?.url) {
                    urls.tmpfiles = json.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
                }
            } catch (e) {
                console.error('Tmpfiles upload error:', e.message);
            }
        })();

        // 5. Uguu.se Direct Host
        const pUguu = (async () => {
            try {
                const form = new FormData();
                form.append('files[]', new Blob([buffer], { type: mime || 'image/jpeg' }), finalFileName);
                const res = await fetch('https://uguu.se/upload.php', {
                    method: 'POST',
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' },
                    body: form
                });
                const json = await res.json();
                if (json && json.success && json.files?.[0]?.url) urls.uguu = json.files[0].url;
            } catch (e) {
                console.error('Uguu upload error:', e.message);
            }
        })();

        // 6. ImgBB (if IMGBB_API_KEY environment variable is configured)
        const pImgBB = (async () => {
            if (imgbbKey && (mime.startsWith('image/') || mediaType === 'image')) {
                try {
                    const form = new FormData();
                    form.append('image', new Blob([buffer], { type: mime || 'image/jpeg' }), finalFileName);
                    const res = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, {
                        method: 'POST',
                        body: form
                    });
                    const json = await res.json();
                    if (json && json.data?.url) urls.imgbb = json.data.url;
                } catch (e) {
                    console.error('ImgBB upload error:', e.message);
                }
            }
        })();

        await Promise.allSettled([pCatbox, pQuax, pLitterbox, pTmpfiles, pUguu, pImgBB]);

        if (Object.keys(urls).length === 0) {
            throw new Error('All file upload servers (Catbox/Qu.ax/Litterbox/TmpFiles/Uguu) rejected the file upload.');
        }

        const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
        const fileSizeKB = (buffer.length / 1024).toFixed(2);
        const formattedSize = buffer.length > 1048576 ? `${fileSizeMB} MB` : `${fileSizeKB} KB`;

        let linksList = [];
        if (urls.catbox) linksList.push(`🐱 *Catbox Permanent:* ${urls.catbox}`);
        if (urls.quax) linksList.push(`🦆 *Qu.ax Direct:* ${urls.quax}`);
        if (urls.litterbox) linksList.push(`📦 *Litterbox 72H:* ${urls.litterbox}`);
        if (urls.tmpfiles) linksList.push(`📁 *TmpFiles Direct:* ${urls.tmpfiles}`);
        if (urls.uguu) linksList.push(`🌐 *Uguu 48H Direct:* ${urls.uguu}`);
        if (urls.imgbb) linksList.push(`🖼️ *ImgBB Direct:* ${urls.imgbb}`);

        const resultCard = `*❪ 🌐 MULTI-SERVER MEDIA UPLOADER 🌐 ❫*

📁 *File Name:* \`${finalFileName}\`
📊 *File Size:* \`${formattedSize}\`
🏷️ *Mime Type:* \`${mime}\`

🔗 *Generated File Links:*
${linksList.join('\n\n')}

> 🌐 POWER BY 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD `;

        await socket.sendMessage(from, { text: resultCard }, { quoted: msg });
        await socket.sendMessage(from, { react: { text: '✅', key: msg.key } });

    } catch (err) {
        console.error('Media uploader error:', err);
        await socket.sendMessage(from, { text: `❌ *Upload Failed:* ${err.message}` }, { quoted: msg });
        await socket.sendMessage(from, { react: { text: '❌', key: msg.key } });
    }
}
break;
case 'csong': {
    const from = sender;
    try {
        const _chm_id = crypto.randomBytes(8).toString('hex');
        const targetJidInput = args[0];
        const songQuery = args.slice(1).join(" ").trim();

        if (!targetJidInput || !songQuery) {
            return await socket.sendMessage(from, { text: "❌ *Format Invalid!*\nUsage: `.csong <jid|.|here> <song name>`" });
        }

        await socket.sendMessage(from, { react: { text: "🎧", key: msg.key } });

        let sJid = targetJidInput;
        if (sJid === '.' || sJid.toLowerCase() === 'here') {
            sJid = from;
        } else if (sJid.includes('whatsapp.com/channel/')) {
            const inviteCode = sJid.split('whatsapp.com/channel/')[1].split('/')[0].split('?')[0];
            try {
                const metadata = await socket.newsletterMetadata('invite', inviteCode);
                sJid = metadata.id;
            } catch (err) {
                return await socket.sendMessage(from, { text: `❌ *Failed to resolve Channel from link:* _${err.message}_` });
            }
        } else if (!sJid.includes('@')) {
            if (/^\d{12,}$/.test(sJid)) sJid = `${sJid}@newsletter`;
            else sJid = `${sJid.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
        }

        let sUrl = songQuery;
        let sMetadata = null;
        if (!/^https?:\/\//i.test(songQuery)) {
            const search = await yts(songQuery);
            if (!search || !search.videos || search.videos.length === 0) {
                return await socket.sendMessage(from, { text: "❌ No results found." });
            }
            sUrl = search.videos[0].url;
            sMetadata = search.videos[0];
        } else {
            const search = await yts(sUrl);
            sMetadata = search.all ? search.all[0] : (search.videos ? search.videos[0] : search);
        }

        // --- Chama Movie YouTube MP3 API ---
        const API_KEY_YTMP3 = "chama_api_23c3e7ffb034f25cf474f6d7ac266f9b";
        const sApiUrl = `https://chama-movie-api.koyeb.app/api/v1/youtube/mp3?url=${encodeURIComponent(sUrl)}&quality=320kbps&source=auto&api_key=${API_KEY_YTMP3}`;
        const sApiResp = await axios.get(sApiUrl).catch(() => null);
        
        if (!sApiResp || !sApiResp.data || !sApiResp.data.status) {
            return await socket.sendMessage(from, { text: "❌ Download API failed." });
        }
        
        const songInfo = sApiResp.data.data || {};
        const sDownloadUrl = songInfo.direct_url || sApiResp.data.download?.url;
        const sTitle = songInfo.title || sMetadata?.title || 'Song';
        const sThumb = songInfo.thumbnail || sMetadata?.thumbnail || sMetadata?.image;

        if (!sDownloadUrl) {
            return await socket.sendMessage(from, { text: "❌ Direct MP3 Download link unavailable." });
        }

        const chm_Mp3 = path.join(os.tmpdir(), `chm_${_chm_id}.mp3`);
        const chm_Tag = path.join(os.tmpdir(), `t_chm_${_chm_id}.mp3`);
        const chm_Opus = path.join(os.tmpdir(), `chm_${_chm_id}.opus`);

        const dlResp = await axios.get(sDownloadUrl, { responseType: 'stream', timeout: 120000 }).catch(() => null);
        if (!dlResp || !dlResp.data) return await socket.sendMessage(from, { text: "❌ Download failed." });

        await new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(chm_Mp3);
            dlResp.data.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        try {
            const _0x6368616d61 = "Powered by 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD"; 
            const sTagUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(_0x6368616d61)}&tl=en&client=tw-ob`;
            const tagResp = await axios.get(sTagUrl, { responseType: 'stream' }).catch(() => null);
            if (tagResp) {
                await new Promise((resolve) => {
                    const writer = fs.createWriteStream(chm_Tag);
                    tagResp.data.pipe(writer);
                    writer.on('finish', resolve);
                    writer.on('error', () => resolve());
                });
            }
        } catch (e) { }

        await new Promise((resolve, reject) => {
            let ff = ffmpeg(chm_Mp3).noVideo();
            if (fs.existsSync(chm_Tag)) {
                ff.input(chm_Tag).complexFilter([
                    '[1:a]adelay=1000|1000,volume=2.0[tag]',
                    '[0:a][tag]amix=inputs=2:duration=first'
                ]);
            }
            ff.audioCodec('libopus').format('opus').on('end', resolve).on('error', reject).save(chm_Opus);
        });

        const sCaption = `🧚‍♂️ *TITLE :* ${sTitle}\n` +
                         `◽️ ⏱ *Duration :* ${sMetadata?.timestamp || 'N/A'}\n\n` +
                         `> *© 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD *`;

        if (sThumb) {
            await socket.sendMessage(sJid, { image: { url: sThumb }, caption: sCaption });
        } else {
            await socket.sendMessage(sJid, { text: sCaption });
        }

        const chm_Buf = fs.readFileSync(chm_Opus);
        await socket.sendMessage(sJid, { audio: chm_Buf, mimetype: 'audio/ogg; codecs=opus', ptt: true });

        if (sJid !== from) await socket.sendMessage(from, { text: "✅ *Song sent successfully!*" });

        try { [chm_Mp3, chm_Tag, chm_Opus].forEach(f => fs.existsSync(f) && fs.unlinkSync(f)); } catch (e) { }

    } catch (e) {
        console.error('csong error:', e);
        await socket.sendMessage(from, { text: "❌ *Error:* " + e.message });
    }
    break;
}
case 'song': {
    const q = args.join(' ');
    if (!q) return reply("කරුණාකර සිංදුවක නමක් දෙන්න. (උදා: .song lelena)");

    try {
        await reply("⏳ *Searching your song...*");
        
        let ytUrl = q;
        let video = null;

        if (!/^https?:\/\//i.test(q)) {
            const searchRes = await yts(q);
            video = searchRes.videos[0];
            if (!video) return reply("කණගාටුයි, ගීතය සොයාගත නොහැක!");
            ytUrl = video.url;
        } else {
            const searchRes = await yts(q);
            video = searchRes.all ? searchRes.all[0] : (searchRes.videos ? searchRes.videos[0] : searchRes);
        }

        // 2. Chama Movie YouTube MP3 API Call
        const API_KEY_YTMP3 = "chama_api_23c3e7ffb034f25cf474f6d7ac266f9b";
        const apiUrl = `https://chama-movie-api.koyeb.app/api/v1/youtube/mp3?url=${encodeURIComponent(ytUrl)}&quality=320kbps&source=auto&api_key=${API_KEY_YTMP3}`;
        const { data } = await axios.get(apiUrl);

        if (!data || !data.status) return reply("API Error: ගීතය ලබාගැනීමට නොහැක.");

        const songInfo = data.data || {};
        const title = songInfo.title || video?.title || 'Song';
        const thumbnail = songInfo.thumbnail || video?.thumbnail || video?.image;
        const dlUrl = songInfo.direct_url || data.download?.url;

        if (!dlUrl) return reply("❌ *Direct Download Link not found!*");

        // 3. Menu Text
        let menuText = `╭━━━〔 *SONG DOWNLOADER* 〕━━━┈
┃ 
┃ 🎵 *Title:* ${title}
┃ ⏱️ *Duration:* ${video?.timestamp || 'N/A'}
┃ 
┃ *Reply with a number below:*
┃  1️⃣ Audio (Normal MP3)
┃  2️⃣ Document (MP3 File)
┃  3️⃣ Voice Note (PTT)
┃
╰━━━━💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘━━━━━━━━━━━━━┈`;

        // 4. Send Menu message and save sentMsg key
        let sentMsg = await socket.sendMessage(sender, { 
            image: { url: thumbnail }, 
            caption: menuText 
        }, { quoted: msg });

        // 5. Message Collector
        const listener = async (msgUpdate) => {
            try {
                const m = msgUpdate.messages[0];
                if (!m || !m.message) return;
                
                const msgText = (m.message.conversation || m.message.extendedTextMessage?.text || '').trim();
                const isReplyToBot = m.message.extendedTextMessage?.contextInfo?.stanzaId === sentMsg.key.id;

                if (isReplyToBot && ['1', '2', '3'].includes(msgText)) {
                    await socket.sendMessage(sender, { text: "⏳ *Downloading your choice...*" }, { quoted: m });

                    if (msgText === '1') {
                        await socket.sendMessage(sender, { audio: { url: dlUrl }, mimetype: 'audio/mpeg' }, { quoted: m });
                    } else if (msgText === '2') {
                        await socket.sendMessage(sender, { document: { url: dlUrl }, mimetype: 'audio/mpeg', fileName: `${title}.mp3` }, { quoted: m });
                    } else if (msgText === '3') {
                        await socket.sendMessage(sender, { audio: { url: dlUrl }, mimetype: 'audio/mp4', ptt: true }, { quoted: m });
                    }
                    
                    socket.ev.off('messages.upsert', listener);
                }
            } catch (err) {
                console.error(err);
            }
        };

        socket.ev.on('messages.upsert', listener);
        
        // Timeout collector after 60s
        setTimeout(() => {
            socket.ev.off('messages.upsert', listener);
        }, 60000);

    } catch (e) {
        console.error(e);
        reply("දෝෂයක් ඇතිවිය: " + e.message);
    }
    break;
}
case 'fb':
case 'facebook': {
    const q = args.join(' ');
    if (!q) return reply("කරුණාකර Facebook Video ලින්ක් එකක් දෙන්න. (උදා: .fb https://www.facebook.com/...)");
    if (!q.includes('facebook.com') && !q.includes('fb.watch') && !q.includes('fb.com')) return reply("කරුණාකර නිවැරදි Facebook ලින්ක් එකක් දෙන්න.");

    try {
        await reply("⏳ *Downloading Facebook video...*");
        
        let videoSent = false;

        // Try API Download First (6s timeout)
        try {
            const apiUrl = `https://dl-api.koyeb.app/api/fbdl?url=${encodeURIComponent(q)}`;
            const { data } = await axios.get(apiUrl, { timeout: 6000 });

            if (data && data.status && data.download) {
                const dlUrl = data.download.hd || data.download.sd || data.download.proxy_hd || data.download.proxy_sd;
                if (dlUrl) {
                    await socket.sendMessage(sender, { 
                        video: { url: dlUrl }, 
                        caption: `🎬 *Title:* ${data.title || "Facebook Video"}\n📊 *Quality:* HD/SD\n\n> *💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD *` 
                    }, { quoted: msg });
                    videoSent = true;
                }
            }
        } catch (apiErr) {
            console.log('[FB Downloader] API call failed/timed out, falling back to yt-dlp:', apiErr.message);
        }

        // Fallback to yt-dlp if API fails or video wasn't sent
        if (!videoSent) {
            const tempFilePath = `./temp_fb_${Date.now()}.mp4`;
            const downloadCmd = `yt-dlp --no-playlist --no-check-certificates --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" -f "b/best[height<=720]/bestvideo[height<=720]+bestaudio/best" -o "${tempFilePath}" "${q}"`;

            exec(downloadCmd, { timeout: 60000 }, async (error, stdout, stderr) => {
                try {
                    if (!error && fs.existsSync(tempFilePath) && fs.statSync(tempFilePath).size > 1000) {
                        await socket.sendMessage(sender, { 
                            video: { url: tempFilePath }, 
                            caption: `🎬 *Facebook Video*\n\n> *💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD *` 
                        }, { quoted: msg });
                    } else {
                        reply("❌ වීඩියෝව Download කිරීමට නොහැකි විය. කරුණාකර ලින්ක් එක පරීක්ෂා කර නැවත උත්සාහ කරන්න.");
                    }
                } catch (sendErr) {
                    console.error('[FB Downloader Send Error]:', sendErr);
                    reply("❌ වීඩියෝව එවීමේදී දෝෂයක් ඇතිවිය.");
                } finally {
                    if (fs.existsSync(tempFilePath)) {
                        fs.unlinkSync(tempFilePath);
                    }
                }
            });
        }

    } catch (e) {
        console.error('[FB Downloader Error]:', e);
        reply("දෝෂයක් ඇතිවිය: කරුණාකර නැවත උත්සාහ කරන්න.");
    }
    break;
}
case 'alive2': {
    try {
        const aliveBody = `💬 𝑯𝒊 𝑩𝒐𝒕 𝑼𝒔𝒆𝒓 ! 𝑯𝒐𝒘 𝑨𝒓𝒆 𝒀𝒐𝒖 ?

🤖 𝙄'm 𝙎imple 𝙅ava𝙎cript 𝘽ot ❤️

┌─❖ 𝑶𝑵𝑳𝑰𝑵𝑬 𝑴𝑶𝑵𝑰𝑻𝑶𝑹 ❖─┐
│ 🟢 𝑵𝒆𝒕𝒘𝒐𝒓𝒌 : 𝑺𝒕𝒂𝒃𝒍𝒆
│ 📗 𝑩𝒖𝒊𝒍𝒅   : 𝒗2.0.0
│ 🛡️ 𝑴𝒐𝒅𝒆    : 𝑷𝒖𝒃𝒍𝒊𝒄
│ ⚡ 𝑴𝒔𝒈 𝑷𝒊𝒏𝒈 : ${Date.now() - msg.messageTimestamp * 1000}𝒎𝒔
│ ⏳ 𝑼𝒑𝒕𝒊𝒎𝒆  : ${process.uptime().toFixed(0)}𝒔
└─────────────❖`;

        const aliveFooter = `${sessionConfig.BOT_FOOTER || config.BOT_FOOTER || 'Powered by JS Bot'}`;

        await sendInteractiveMessage(socket, {
            jid: sender,
            header: "🤖 STATUS: ONLINE",
            text: aliveBody,
            footer: aliveFooter,
            buttons: [
                { text: "📜 GET MENU", id: ".menu" },
                { text: "👤 CONTACT OWNER", id: ".owner" }
            ]
        }, { quoted: msg });

        await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

    } catch (e) {
        console.error('alive2 command error:', e);
        await socket.sendMessage(sender, {
            text: `❌ ERROR\n\nAn error occurred: ${e.message}`
        }, { quoted: msg });
    }
}
break;
case 'owner': {
    try {
        await socket.sendMessage(sender, { react: { text: '👑', key: msg.key } });
        const contactsArray = [
            {
                displayName: '𝗢𝗪𝗡𝗘𝗥',
                vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD OWNER 🍃\nTEL;type=CELL;type=VOICE;waid=94752120756:+94752120756\nEND:VCARD`
            }
        ];

        await socket.sendMessage(sender, {
            contacts: {
                displayName: "𝐎𝐖𝐍𝐄𝐑 𝐋𝐈𝐒𝐓",
                contacts: contactsArray
            }
        }, { quoted: msg });

    } catch (error) {
        console.error('Owner command error:', error);
        await socket.sendMessage(sender, { text: '❌ *Error:* Unable to fetch owner details.' }, { quoted: msg });
    }
}
break;          
case 'moviebox':
case 'movieboxdl': {
    const DEFAULT_FOOTER = `\n\n> 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘 CINE HUB 🧚‍♂️\n> 🧬 ᴘᴏᴡᴇʀᴇᴅ ʙʏ 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD 🍃`;
    const chatJid = msg.key.remoteJid;
    const sender  = msg.key.participant || msg.key.remoteJid;

    function getCircledNumber(num) {
        const circledNumbers = [
            '①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩',
            '⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳'
        ];
        return circledNumbers[num - 1] || `[${num}]`;
    }

    function getSubEmoji(title) {
        const lower = title.toLowerCase();
        if (lower.includes('සිංහල') || lower.includes('sinhala') || /\bsi\b/.test(lower)) return '🇱🇰';
        if (lower.includes('english')    || /\ben\b/.test(lower))       return '🇬🇧';
        if (lower.includes('arabic')     || lower.includes('العربية'))  return '🇸🇦';
        if (lower.includes('spanish')    || lower.includes('español'))   return '🇪🇸';
        if (lower.includes('french')     || lower.includes('français'))  return '🇫🇷';
        if (lower.includes('german')     || lower.includes('deutsch'))   return '🇩🇪';
        if (lower.includes('tamil')      || /\bta\b/.test(lower))       return '🇮🇳';
        if (lower.includes('hindi')      || /\bhi\b/.test(lower))       return '🇮🇳';
        if (lower.includes('indonesian') || /\bid\b/.test(lower))       return '🇮🇩';
        return '📝';
    }

    // Wait for a quoted reply from the same sender in the same chat
    const waitForUserReply = async (targetMsgId, timeoutMs = 120000) => {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                socket.ev.off('messages.upsert', listener);
                resolve(null);
            }, timeoutMs);
            const listener = ({ messages }) => {
                const m = messages[0];
                if (!m?.message) return;
                const contextInfo = m.message.extendedTextMessage?.contextInfo;
                if (contextInfo?.stanzaId === targetMsgId) {
                    const replierJid = m.key.participant || m.key.remoteJid;
                    if (m.key.remoteJid === chatJid && replierJid === sender) {
                        clearTimeout(timeout);
                        socket.ev.off('messages.upsert', listener);
                        const text = m.message.conversation || m.message.extendedTextMessage?.text;
                        resolve({ text: text?.trim(), key: m.key });
                    }
                }
            };
            socket.ev.on('messages.upsert', listener);
        });
    };

    if (!args.length) {
        await socket.sendMessage(chatJid, {
            text: `*❪ ERROR ❫*\n\n⚠️ *Invalid Usage!*\n\n🎬 *Example:*\n• .moviebox avatar\n\n📝 _Please provide a Movie or TV Series name!_${DEFAULT_FOOTER}`
        }, { quoted: msg });
        break;
    }

    const movieboxQuery = args.join(' ');

    await socket.sendMessage(chatJid, {
        text: `*❪ SEARCHING ❫*\n\n🔍 *Searching MovieBox...*\n⚡ _Please wait a moment._`
    });

    const API_BASE      = "https://chama-movie-api.koyeb.app";
    const API_KEY       = "chama_api_23c3e7ffb034f25cf474f6d7ac266f9b";
    const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500";

    try {
        // ══════════════════════════════════════════════════
        // STEP 1 — SEARCH
        // ══════════════════════════════════════════════════
        const searchRes  = await axios.get(`${API_BASE}/api/v1/movie/moviebox/search?q=${encodeURIComponent(movieboxQuery)}&api_key=${API_KEY}`);
        const searchData = searchRes.data;

        if (!searchData.status || !searchData.data || searchData.data.length === 0) {
            await socket.sendMessage(chatJid, {
                text: `*❪ NO RESULTS ❫*\n\n😞 *No Results Found!*\n\n🎬 *Query:* _${movieboxQuery}_${DEFAULT_FOOTER}`
            }, { quoted: msg });
            break;
        }

        const results = searchData.data.slice(0, 20);

        let listText = `*❪ SEARCH RESULTS ❫*\n\n🎯 *Query:* _${movieboxQuery}_\n📊 *Results:* _${results.length} Items_\n\n*👇 SELECT A NUMBER 👇*\n\n`;
        results.forEach((item, index) => {
            const type = item.type === 'tvshows' ? '📺 TV' : '🎥 Movie';
            listText += `${getCircledNumber(index + 1)} ➜ ${type} | _${item.title.substring(0, 35)}_\n`;
        });
        listText += DEFAULT_FOOTER;

        const listMsg    = await socket.sendMessage(chatJid, { text: listText }, { quoted: msg });
        const mediaReply = await waitForUserReply(listMsg.key.id);

        if (!mediaReply) {
            await socket.sendMessage(chatJid, { text: `⏳ *Timeout!* _Request Cancelled due to inactivity._` }, { quoted: listMsg });
            break;
        }

        const choiceIndex = parseInt(mediaReply.text) - 1;
        if (isNaN(choiceIndex) || choiceIndex < 0 || choiceIndex >= results.length) {
            await socket.sendMessage(chatJid, { text: `⚠️ *Invalid Selection!*` }, { quoted: mediaReply });
            break;
        }

        const selectedItem = results[choiceIndex];
        const isTvShow     = selectedItem.type === 'tvshows';

        // ══════════════════════════════════════════════════
        // ██  MOVIE FLOW  ██
        // ══════════════════════════════════════════════════
        if (!isTvShow) {
            await socket.sendMessage(chatJid, { react: { text: '⏳', key: mediaReply.key } });

            const movieRes  = await axios.get(`${API_BASE}/api/v1/movie/moviebox/info?q=${encodeURIComponent(selectedItem.link)}&api_key=${API_KEY}`);
            const movieInfo = movieRes.data.data;
            const downloads = movieInfo.downloads || [];

            if (downloads.length === 0) {
                await socket.sendMessage(chatJid, { text: `❌ *No download links found for this movie!*` }, { quoted: mediaReply });
                break;
            }

            const videoDls = downloads.filter(d => d.quality !== 'SUB' && !d.title?.toLowerCase().includes('subtitle'));
            const subDls   = downloads.filter(d => d.quality === 'SUB'  ||  d.title?.toLowerCase().includes('subtitle'));

            // ── Quality ──
            let qText = `🎥 *${movieInfo.title}*\n\n👇 *SELECT VIDEO QUALITY* 👇\n\n`;
            videoDls.forEach((q, i) => {
                qText += `${getCircledNumber(i + 1)} ➜ 🎥 ${q.quality} | 💾 ${q.size || 'N/A'}\n`;
            });
            qText += `\n_Reply with the quality number._${DEFAULT_FOOTER}`;

            const qMsg   = await socket.sendMessage(chatJid, { image: { url: movieInfo.image || DEFAULT_IMAGE }, caption: qText }, { quoted: mediaReply });
            const qReply = await waitForUserReply(qMsg.key.id);
            if (!qReply) break;

            const qIndex = parseInt(qReply.text) - 1;
            if (isNaN(qIndex) || qIndex < 0 || qIndex >= videoDls.length) {
                await socket.sendMessage(chatJid, { text: `⚠️ *Invalid Quality Selection!*` }, { quoted: qReply });
                break;
            }
            const selectedVideo = videoDls[qIndex];

            // ── Subtitle ──
            let selectedSub = null;
            let subReplyKey = qReply.key;

            if (subDls.length > 0) {
                let sText = `🎥 *${movieInfo.title}*\n\n👇 *SELECT SUBTITLE LANGUAGE* 👇\n\n`;
                subDls.forEach((s, i) => {
                    const langName = s.title.replace('Subtitle - ', '').trim();
                    sText += `${getCircledNumber(i + 1)} ➜ ${getSubEmoji(langName)} ${langName}\n`;
                });
                sText += `${getCircledNumber(subDls.length + 1)} ➜ ❌ No Subtitles\n\n_Reply with the subtitle number._${DEFAULT_FOOTER}`;

                const sMsg   = await socket.sendMessage(chatJid, { text: sText }, { quoted: qReply });
                const sReply = await waitForUserReply(sMsg.key.id);
                if (!sReply) break;

                subReplyKey  = sReply.key;
                const sIndex = parseInt(sReply.text) - 1;
                if (sIndex >= 0 && sIndex < subDls.length) selectedSub = subDls[sIndex];
            }

            // ── Send Movie ──
            await socket.sendMessage(chatJid, { react: { text: '📤', key: subReplyKey } });

            await socket.sendMessage(chatJid, {
                document : { url: selectedVideo.link || selectedVideo.url },
                mimetype : 'video/mp4',
                fileName : `${movieInfo.title} [${selectedVideo.quality}].mp4`,
                caption  : `🎬 *${movieInfo.title}*\n\n📽️ *Quality:* ${selectedVideo.quality}\n💾 *Size:* ${selectedVideo.size || 'N/A'}${DEFAULT_FOOTER}`
            }, { quoted: { key: subReplyKey, message: { conversation: '' } } });

            if (selectedSub) {
                const langName = selectedSub.title.replace('Subtitle - ', '').trim();
                await socket.sendMessage(chatJid, {
                    document : { url: selectedSub.link || selectedSub.url },
                    mimetype : 'application/x-subrip',
                    fileName : `${movieInfo.title} - ${langName}.srt`
                });
            }

            await socket.sendMessage(chatJid, { react: { text: '✅', key: subReplyKey } });

        // ══════════════════════════════════════════════════
        // ██  TV SERIES FLOW  ██
        // ══════════════════════════════════════════════════
        } else {
            await socket.sendMessage(chatJid, { react: { text: '⏳', key: mediaReply.key } });

            const tvRes   = await axios.get(`${API_BASE}/api/v1/movie/moviebox/tv/info?q=${encodeURIComponent(selectedItem.link)}&api_key=${API_KEY}`);
            const tvInfo  = tvRes.data.data;
            const seasons = tvInfo.seasons || [];

            if (seasons.length === 0) {
                await socket.sendMessage(chatJid, { text: `❌ *No Seasons found for this TV Series!*` }, { quoted: mediaReply });
                break;
            }

            const totalEpisodes = seasons.reduce((sum, s) => sum + s.episodes.length, 0);

            // ══════════════════════════════════════════════════
            // SEASON LIST MENU
            // • Reply  00  → Download ALL Seasons + ALL Episodes
            // • Reply   0  → Download ALL Episodes of ONE Season (pick season next)
            // • Reply  1~N → Pick that season, then pick single episode
            // ══════════════════════════════════════════════════
            let seasonMenuText =
                `📺 *${tvInfo.title}*\n` +
                `🗂️ *Seasons:* ${seasons.length}   📦 *Total Episodes:* ${totalEpisodes}\n\n` +
                `*👇 SELECT A SEASON OR SHORTCUT 👇*\n\n` +
                `*00* ➜ 📥 ALL Seasons + ALL Episodes\n` +
                `*0*  ➜ 📁 ALL Episodes of ONE Season\n\n`;

            seasons.forEach((s, i) => {
                seasonMenuText += `${getCircledNumber(i + 1)} ➜ Season ${s.season} (${s.episodes.length} Episodes)\n`;
            });
            seasonMenuText += `\n_Reply with a number._${DEFAULT_FOOTER}`;

            const seasonMsg   = await socket.sendMessage(chatJid, {
                image   : { url: tvInfo.image || DEFAULT_IMAGE },
                caption : seasonMenuText
            }, { quoted: mediaReply });

            const seasonReply = await waitForUserReply(seasonMsg.key.id);
            if (!seasonReply) {
                await socket.sendMessage(chatJid, { text: `⏳ *Timeout!* _Request Cancelled._` }, { quoted: seasonMsg });
                break;
            }

            const rawInput = seasonReply.text?.trim();

            // ── Helper: resolve quality + subtitle via sample episode ──
            const resolveQualityAndSub = async (seasonNum, epNum, quotedKey) => {
                const sampleRes  = await axios.get(
                    `${API_BASE}/api/v1/movie/moviebox/tv/dl?q=${encodeURIComponent(selectedItem.link)}&se=${seasonNum}&ep=${epNum}&api_key=${API_KEY}`
                );
                const sampleDls      = sampleRes.data.data || [];
                const sampleVideos   = sampleDls.filter(d => d.quality !== 'SUB' && !d.title?.toLowerCase().includes('subtitle'));
                const sampleSubs     = sampleDls.filter(d => d.quality === 'SUB'  ||  d.title?.toLowerCase().includes('subtitle'));
                const uniqueQualities = [...new Map(sampleVideos.map(i => [i.quality, i])).values()];
                const uniqueSubs      = [...new Map(sampleSubs.map(i => {
                    const lang = i.title.replace('Subtitle - ', '').replace(/ \(S\d+E\d+\)/i, '').trim();
                    return [lang, { ...i, langName: lang }];
                })).values()];

                if (uniqueQualities.length === 0) return null;

                // Quality menu
                let qText = `📺 *${tvInfo.title}*\n\n👇 *SELECT VIDEO QUALITY* 👇\n\n`;
                uniqueQualities.forEach((q, i) => { qText += `${getCircledNumber(i + 1)} ➜ 🎥 ${q.quality}\n`; });
                qText += `\n_Reply with the quality number._${DEFAULT_FOOTER}`;

                const qMsg   = await socket.sendMessage(chatJid, { text: qText }, { quoted: { key: quotedKey, message: { conversation: '' } } });
                const qReply = await waitForUserReply(qMsg.key.id);
                if (!qReply) return null;

                const qIdx            = parseInt(qReply.text) - 1;
                const selectedQuality = uniqueQualities[qIdx]?.quality || uniqueQualities[0].quality;

                // Subtitle menu
                let selectedSubLang = null;
                let lastReplyKey    = qReply.key;

                if (uniqueSubs.length > 0) {
                    let sText = `📺 *${tvInfo.title}*\n\n👇 *SELECT SUBTITLE LANGUAGE* 👇\n\n`;
                    uniqueSubs.forEach((s, i) => { sText += `${getCircledNumber(i + 1)} ➜ ${getSubEmoji(s.langName)} ${s.langName}\n`; });
                    sText += `${getCircledNumber(uniqueSubs.length + 1)} ➜ ❌ No Subtitles\n\n_Reply with the subtitle number._${DEFAULT_FOOTER}`;

                    const sMsg   = await socket.sendMessage(chatJid, { text: sText }, { quoted: qReply });
                    const sReply = await waitForUserReply(sMsg.key.id);
                    if (!sReply) return null;

                    lastReplyKey  = sReply.key;
                    const sIdx    = parseInt(sReply.text) - 1;
                    if (sIdx >= 0 && sIdx < uniqueSubs.length) selectedSubLang = uniqueSubs[sIdx].langName;
                }

                return { selectedQuality, selectedSubLang, lastReplyKey };
            };

            // ── Helper: download one episode and send to chat ──
            const downloadEpisode = async (seasonNum, epNum, quality, subLang) => {
                const epRes  = await axios.get(
                    `${API_BASE}/api/v1/movie/moviebox/tv/dl?q=${encodeURIComponent(selectedItem.link)}&se=${seasonNum}&ep=${epNum}&api_key=${API_KEY}`
                );
                const allDls = epRes.data.data || [];

                const targetVideo = allDls.find(d => d.quality === quality) || allDls.find(d => d.quality !== 'SUB');
                if (!targetVideo) return false;

                await socket.sendMessage(chatJid, {
                    document : { url: targetVideo.link || targetVideo.url },
                    mimetype : 'video/mp4',
                    fileName : `${tvInfo.title} S${seasonNum}E${epNum} [${targetVideo.quality}].mp4`,
                    caption  : `🎬 *${tvInfo.title}*\n📺 Season ${seasonNum} – Episode ${epNum}\n📽️ Quality: ${targetVideo.quality}${DEFAULT_FOOTER}`
                });

                if (subLang) {
                    const targetSub = allDls.find(d => d.title?.includes(subLang));
                    if (targetSub) {
                        await socket.sendMessage(chatJid, {
                            document : { url: targetSub.link || targetSub.url },
                            mimetype : 'application/x-subrip',
                            fileName : `${tvInfo.title} S${seasonNum}E${epNum} - ${subLang}.srt`
                        });
                    }
                }
                return true;
            };

            // ════════════════════════════════════════════════
            // SHORTCUT  00  — ALL Seasons + ALL Episodes
            // ════════════════════════════════════════════════
            if (rawInput === '00') {
                await socket.sendMessage(chatJid, { react: { text: '🔎', key: seasonReply.key } });

                const resolved = await resolveQualityAndSub(seasons[0].season, seasons[0].episodes[0], seasonReply.key);
                if (!resolved) break;

                const { selectedQuality, selectedSubLang, lastReplyKey } = resolved;

                await socket.sendMessage(chatJid, {
                    text:
                        `📥 *Full Series Download Started!*\n\n` +
                        `📺 *${tvInfo.title}*\n` +
                        `🗂️ *Seasons:* ${seasons.length}\n` +
                        `📦 *Total Episodes:* ${totalEpisodes}\n` +
                        `📽️ *Quality:* ${selectedQuality}\n` +
                        `📝 *Subtitle:* ${selectedSubLang || 'None'}\n\n` +
                        `⚡ _Please keep the bot running..._`
                }, { quoted: { key: lastReplyKey, message: { conversation: '' } } });

                let totalSuccess = 0, totalFails = 0;

                for (const season of seasons) {
                    await socket.sendMessage(chatJid, {
                        text: `🗂️ *Starting Season ${season.season}* (${season.episodes.length} Episodes)\n📺 _${tvInfo.title}_`
                    });

                    let sSuccess = 0, sFails = 0;

                    for (const epNum of season.episodes) {
                        try {
                            const ok = await downloadEpisode(season.season, epNum, selectedQuality, selectedSubLang);
                            ok ? (sSuccess++, totalSuccess++) : (sFails++, totalFails++);
                            await new Promise(r => setTimeout(r, 2000));
                        } catch (err) {
                            sFails++; totalFails++;
                            console.error(`Error S${season.season}E${epNum}:`, err);
                        }
                    }

                    await socket.sendMessage(chatJid, {
                        text: `✅ *Season ${season.season} Done!*  ✅ ${sSuccess} OK  ❌ ${sFails} Failed`
                    });
                }

                await socket.sendMessage(chatJid, {
                    text:
                        `🎉 *FULL SERIES DOWNLOAD COMPLETE!*\n\n` +
                        `📺 *Title:* ${tvInfo.title}\n` +
                        `🗂️ *Seasons:* ${seasons.length}\n` +
                        `📦 *Total Episodes:* ${totalEpisodes}\n` +
                        `✅ *Success:* ${totalSuccess} Episodes\n` +
                        `❌ *Failed:* ${totalFails} Episodes${DEFAULT_FOOTER}`
                });

            // ════════════════════════════════════════════════
            // SHORTCUT   0  — ALL Episodes of ONE Season
            // ════════════════════════════════════════════════
            } else if (rawInput === '0') {

                // Ask which season
                let sznText = `📺 *${tvInfo.title}*\n\n👇 *SELECT A SEASON* 👇\n\n`;
                seasons.forEach((s, i) => { sznText += `${getCircledNumber(i + 1)} ➜ Season ${s.season} (${s.episodes.length} Episodes)\n`; });
                sznText += `\n_Reply with season number._${DEFAULT_FOOTER}`;

                const sznMsg   = await socket.sendMessage(chatJid, { text: sznText }, { quoted: seasonReply });
                const sznReply = await waitForUserReply(sznMsg.key.id);
                if (!sznReply) break;

                const sznIdx = parseInt(sznReply.text) - 1;
                if (isNaN(sznIdx) || sznIdx < 0 || sznIdx >= seasons.length) {
                    await socket.sendMessage(chatJid, { text: `⚠️ *Invalid Season!*` }, { quoted: sznReply });
                    break;
                }
                const activeSeason = seasons[sznIdx];

                await socket.sendMessage(chatJid, { react: { text: '🔎', key: sznReply.key } });

                const resolved = await resolveQualityAndSub(activeSeason.season, activeSeason.episodes[0], sznReply.key);
                if (!resolved) break;

                const { selectedQuality, selectedSubLang, lastReplyKey } = resolved;

                await socket.sendMessage(chatJid, {
                    text:
                        `📥 *Downloading Season ${activeSeason.season}...*\n\n` +
                        `📺 *${tvInfo.title}*\n` +
                        `📦 *Episodes:* ${activeSeason.episodes.length}\n` +
                        `📽️ *Quality:* ${selectedQuality}\n` +
                        `📝 *Subtitle:* ${selectedSubLang || 'None'}\n\n` +
                        `⚡ _Please keep the bot running..._`
                }, { quoted: { key: lastReplyKey, message: { conversation: '' } } });

                let success = 0, fails = 0;

                for (const epNum of activeSeason.episodes) {
                    try {
                        const ok = await downloadEpisode(activeSeason.season, epNum, selectedQuality, selectedSubLang);
                        ok ? success++ : fails++;
                        await new Promise(r => setTimeout(r, 2000));
                    } catch (err) {
                        fails++;
                        console.error(`Error S${activeSeason.season}E${epNum}:`, err);
                    }
                }

                await socket.sendMessage(chatJid, {
                    text:
                        `✅ *SEASON DOWNLOAD COMPLETE!*\n\n` +
                        `📺 *Title:* ${tvInfo.title}\n` +
                        `🗂️ *Season:* ${activeSeason.season}\n` +
                        `✅ *Success:* ${success} Episodes\n` +
                        `❌ *Failed:* ${fails} Episodes${DEFAULT_FOOTER}`
                });

            // ════════════════════════════════════════════════
            // NORMAL  1~N  — Pick Season → Pick Single Episode
            // ════════════════════════════════════════════════
            } else {
                const sznIdx = parseInt(rawInput) - 1;
                if (isNaN(sznIdx) || sznIdx < 0 || sznIdx >= seasons.length) {
                    await socket.sendMessage(chatJid, { text: `⚠️ *Invalid Input!*\n\n_Reply 00 / 0 / or a season number._` }, { quoted: seasonReply });
                    break;
                }
                const activeSeason = seasons[sznIdx];

                // Episode list
                let epText =
                    `📺 *${tvInfo.title} — Season ${activeSeason.season}*\n` +
                    `📦 *Episodes:* ${activeSeason.episodes.length}\n\n` +
                    `👇 *SELECT AN EPISODE* 👇\n\n`;
                activeSeason.episodes.forEach((epNum, i) => {
                    epText += `${getCircledNumber(i + 1)} ➜ Episode ${epNum}\n`;
                });
                epText += `\n_Reply with episode number._${DEFAULT_FOOTER}`;

                const epMsg   = await socket.sendMessage(chatJid, { text: epText }, { quoted: seasonReply });
                const epReply = await waitForUserReply(epMsg.key.id);
                if (!epReply) break;

                const epIdx = parseInt(epReply.text) - 1;
                if (isNaN(epIdx) || epIdx < 0 || epIdx >= activeSeason.episodes.length) {
                    await socket.sendMessage(chatJid, { text: `⚠️ *Invalid Episode!*` }, { quoted: epReply });
                    break;
                }
                const chosenEp = activeSeason.episodes[epIdx];

                await socket.sendMessage(chatJid, { react: { text: '🔎', key: epReply.key } });

                const resolved = await resolveQualityAndSub(activeSeason.season, chosenEp, epReply.key);
                if (!resolved) break;

                const { selectedQuality, selectedSubLang, lastReplyKey } = resolved;

                await socket.sendMessage(chatJid, { react: { text: '📤', key: lastReplyKey } });

                const ok = await downloadEpisode(activeSeason.season, chosenEp, selectedQuality, selectedSubLang);

                await socket.sendMessage(chatJid, {
                    react: { text: ok ? '✅' : '❌', key: lastReplyKey }
                });

                if (!ok) {
                    await socket.sendMessage(chatJid, {
                        text: `❌ *No video found for S${activeSeason.season}E${chosenEp}!*`
                    });
                }
            }
        }
    } catch (error) {
        console.error('Moviebox command error:', error);
        await socket.sendMessage(chatJid, {
            text: `❌ *ERROR*\n\n*System Error:* ${error.message || 'Unknown error occurred.'}`
        }, { quoted: msg });
    }
    break;
} 

case 'chithrapata':
case 'chithrapatadl': {
    const DEFAULT_FOOTER = `\n\n> 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘 CINE HUB \n> 🧬 ᴘᴏᴡᴇʀᴇᴅ ʙʏ 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD `;
    const chatJid = msg.key.remoteJid;
    const sender  = msg.key.participant || msg.key.remoteJid;

    function getCircledNumber(num) {
        const circledNumbers = [
            '①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩',
            '⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳'
        ];
        return circledNumbers[num - 1] || `[${num}]`;
    }

    const waitForUserReply = async (targetMsgId, timeoutMs = 120000) => {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                socket.ev.off('messages.upsert', listener);
                resolve(null);
            }, timeoutMs);
            const listener = ({ messages }) => {
                const m = messages[0];
                if (!m?.message) return;
                const contextInfo = m.message.extendedTextMessage?.contextInfo;
                if (contextInfo?.stanzaId === targetMsgId) {
                    const replierJid = m.key.participant || m.key.remoteJid;
                    if (m.key.remoteJid === chatJid && replierJid === sender) {
                        clearTimeout(timeout);
                        socket.ev.off('messages.upsert', listener);
                        const text = m.message.conversation || m.message.extendedTextMessage?.text;
                        resolve({ text: text?.trim(), key: m.key });
                    }
                }
            };
            socket.ev.on('messages.upsert', listener);
        });
    };

    if (!args.length) {
        await socket.sendMessage(chatJid, {
            text: `*❪ ERROR ❫*\n\n⚠️ *Invalid Usage!*\n\n🎬 *Example:*\n• .chithrapata uyir\n\n📝 _Please provide a Movie name!_${DEFAULT_FOOTER}`
        }, { quoted: msg });
        break;
    }

    const chithrapataQuery = args.join(' ');

    await socket.sendMessage(chatJid, {
        text: `*❪ SEARCHING ❫*\n\n🔍 *Searching Chithrapata.lk...*\n⚡ _Please wait a moment._`
    });

    const API_BASE      = "https://chama-movie-api.koyeb.app";
    const API_KEY       = "chama_api_23c3e7ffb034f25cf474f6d7ac266f9b";
    const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500";

    try {
        const searchRes  = await axios.get(`${API_BASE}/api/v1/chithrapata/search?q=${encodeURIComponent(chithrapataQuery)}&api_key=${API_KEY}`);
        const searchData = searchRes.data;

        if (!searchData.status || !searchData.results || searchData.results.length === 0) {
            await socket.sendMessage(chatJid, {
                text: `*❪ NO RESULTS ❫*\n\n😞 *No Results Found!*\n\n🎬 *Query:* _${chithrapataQuery}_${DEFAULT_FOOTER}`
            }, { quoted: msg });
            break;
        }

        const results = searchData.results.slice(0, 20);

        let listText = `*❪ SEARCH RESULTS ❫*\n\n🎯 *Query:* _${chithrapataQuery}_\n📊 *Results:* _${results.length} Items_\n\n*👇 SELECT A NUMBER 👇*\n\n`;
        results.forEach((item, index) => {
            listText += `${getCircledNumber(index + 1)} ➜ 🎥 Movie | _${item.title.substring(0, 35)}_\n`;
        });
        listText += DEFAULT_FOOTER;

        const listMsg    = await socket.sendMessage(chatJid, { text: listText }, { quoted: msg });
        const mediaReply = await waitForUserReply(listMsg.key.id);

        if (!mediaReply) {
            await socket.sendMessage(chatJid, { text: `⏳ *Timeout!* _Request Cancelled due to inactivity._` }, { quoted: listMsg });
            break;
        }

        const choiceIndex = parseInt(mediaReply.text) - 1;
        if (isNaN(choiceIndex) || choiceIndex < 0 || choiceIndex >= results.length) {
            await socket.sendMessage(chatJid, { text: `⚠️ *Invalid Selection!*` }, { quoted: mediaReply });
            break;
        }

        const selectedItem = results[choiceIndex];

        await socket.sendMessage(chatJid, { react: { text: '⏳', key: mediaReply.key } });

        const movieRes  = await axios.get(`${API_BASE}/api/v1/chithrapata/infodl?url=${encodeURIComponent(selectedItem.url)}&api_key=${API_KEY}`);
        const movieInfo = movieRes.data.result;
        const downloads = movieInfo.downloads || [];

        if (downloads.length === 0) {
            await socket.sendMessage(chatJid, { text: `❌ *No download links found for this movie!*` }, { quoted: mediaReply });
            break;
        }

        let qText = `🎬 *${movieInfo.title}*\n\n`;
        if (movieInfo.story && movieInfo.story !== 'No storyline available.') {
            qText += `📖 *Story:* _${movieInfo.story}_\n\n`;
        }
        qText += `👇 *SELECT VIDEO QUALITY* 👇\n\n`;
        downloads.forEach((q, i) => {
            qText += `${getCircledNumber(i + 1)} ➜ 🎥 ${q.quality} | 💾 ${q.size || 'N/A'}\n`;
        });
        qText += `\n_Reply with the quality number._${DEFAULT_FOOTER}`;

        const qMsg   = await socket.sendMessage(chatJid, { image: { url: movieInfo.image || selectedItem.thumbnail || DEFAULT_IMAGE }, caption: qText }, { quoted: mediaReply });
        const qReply = await waitForUserReply(qMsg.key.id);
        if (!qReply) break;

        const qIndex = parseInt(qReply.text) - 1;
        if (isNaN(qIndex) || qIndex < 0 || qIndex >= downloads.length) {
            await socket.sendMessage(chatJid, { text: `⚠️ *Invalid Quality Selection!*` }, { quoted: qReply });
            break;
        }
        const selectedVideo = downloads[qIndex];

        await socket.sendMessage(chatJid, { react: { text: '📤', key: qReply.key } });

        let fileSent = false;
        try {
            await socket.sendMessage(chatJid, {
                document : { url: selectedVideo.link },
                mimetype : 'video/mp4',
                fileName : `${movieInfo.title} [Chithrapata].mp4`,
                caption  : `🎬 *${movieInfo.title}*\n\n📽️ *Quality:* ${selectedVideo.quality}\n💾 *Size:* ${selectedVideo.size || 'N/A'}${DEFAULT_FOOTER}`
            }, { quoted: { key: qReply.key, message: { conversation: '' } } });
            fileSent = true;
        } catch (uploadErr) {
            console.error('[Chithrapata] Direct document upload failed/terminated:', uploadErr.message);

            const tempFilePath = `./temp_chithrapata_${Date.now()}.mp4`;
            try {
                const downloadCmd = `yt-dlp --no-playlist --no-check-certificates -o "${tempFilePath}" "${selectedVideo.link}"`;
                await new Promise((resolve, reject) => {
                    exec(downloadCmd, { timeout: 300000 }, (err) => (err || !fs.existsSync(tempFilePath)) ? reject(err) : resolve());
                });

                if (fs.existsSync(tempFilePath)) {
                    await socket.sendMessage(chatJid, {
                        document : { url: tempFilePath },
                        mimetype : 'video/mp4',
                        fileName : `${movieInfo.title} [Chithrapata].mp4`,
                        caption  : `🎬 *${movieInfo.title}*\n\n📽️ *Quality:* ${selectedVideo.quality}\n💾 *Size:* ${selectedVideo.size || 'N/A'}${DEFAULT_FOOTER}`
                    }, { quoted: { key: qReply.key, message: { conversation: '' } } });
                    fileSent = true;
                }
            } catch (dlErr) {
                console.error('[Chithrapata] Temp download fallback failed:', dlErr.message);
            } finally {
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            }
        }

        if (!fileSent) {
            await socket.sendMessage(chatJid, {
                text: `📌 *Direct Movie Stream & Download Link:*\n\n🎬 *${movieInfo.title}*\n📽️ *Quality:* ${selectedVideo.quality}\n🔗 ${selectedVideo.link}${DEFAULT_FOOTER}`
            }, { quoted: qReply });
        }

        await socket.sendMessage(chatJid, { react: { text: fileSent ? '✅' : '🔗', key: qReply.key } });

    } catch (error) {
        console.error('Chithrapata command error:', error);
        await socket.sendMessage(chatJid, {
            text: `❌ *ERROR*\n\n*System Error:* ${error.message || 'Unknown error occurred.'}`
        }, { quoted: msg });
    }
    break;
}

case 'fitgirl':             
case 'game': {
    const chatJid = msg.key.remoteJid;
    const DEFAULT_FOOTER = `\n\n> 🎮 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘 CINE HUB 🎮\n> 🧬 ᴘᴏᴡᴇʀᴇᴅ ʙʏ 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD 🧚‍♂️`;

    function getCircledNumber(num) {
        const circledNumbers = [
            '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩',
            '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳',
            '㉑', '㉒', '㉓', '㉔', '㉕', '㉖', '㉗', '㉘', '㉙', '㉚'
        ];
        return circledNumbers[num - 1] || `[${num}]`;
    }

    if (!args.length) {
        await socket.sendMessage(chatJid, {
            text: `*❪ ERROR ❫*\n\n⚠️ *Invalid Usage!*\n\n🎮 *Example:*\n• .game gta v\n• .fitgirl cyberpunk 2077\n\n📝 _Please provide the Game name!_${DEFAULT_FOOTER}`
        }, { quoted: msg });
        break;
    }

    const gameQuery = args.join(' ');
    await socket.sendMessage(chatJid, { 
        text: `*❪ SEARCHING ❫*\n\n🔍 *Searching Fitgirl Games...*\n⚡ _Please wait a moment._`
    });

    const API_BASE = "https://chama-movie-api.koyeb.app";
    const API_KEY = "chama_api_23c3e7ffb034f25cf474f6d7ac266f9b";
    const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=500";

    let searchResponse = null;
    let searchRetries = 3;
    while (searchRetries > 0 && !searchResponse) {
        try {
            searchResponse = await axios.get(`${API_BASE}/api/v1/movie/fitgirl/search?q=${encodeURIComponent(gameQuery)}&api_key=${API_KEY}`, { timeout: 120000 });
        } catch (searchErr) {
            searchRetries--;
            if (searchRetries === 0) {
                throw searchErr;
            }
            console.log(`Fitgirl search failed, retrying... (${searchRetries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
    const searchData = searchResponse.data;

    try {
        if (!searchData.status || !searchData.results || searchData.results.length === 0) {
            await socket.sendMessage(chatJid, {
                text: `*❪ NO RESULTS ❫*\n\n😞 *No Games Found!*\n\n🎮 *Query:* _${gameQuery}_\n💡 *Tip:* _Please check the spelling and try again!_${DEFAULT_FOOTER}`
            }, { quoted: msg });
            break;
        }

        const gameResults = searchData.results.slice(0, 25);
        let listText = `*❪ GAME SEARCH RESULTS ❫*\n\n🎯 *Query:* _${gameQuery}_\n📊 *Results:* _${gameResults.length} Items_\n\n*👇 SELECT A NUMBER 👇*\n\n`;

        gameResults.forEach((item, index) => {
            const num = getCircledNumber(index + 1);
            listText += `${num} ➜ 🎮 _${item.title.substring(0, 45)}_\n📅 _Date: ${item.date || 'N/A'}_\n\n`;
        });

        listText += `${DEFAULT_FOOTER}`;
        
        const sentMsg = await socket.sendMessage(chatJid, { text: listText }, { quoted: msg });
        const messageID = sentMsg.key.id;

        const cleanupTimeout = setTimeout(() => {
            socket.ev.off('messages.upsert', handleSelection);
            console.log(`[Fitgirl] Cleaned up stale selection listener for msg ID: ${messageID}`);
        }, 120000);

        const handleSelection = async ({ messages: replyMessages }) => {
            const replyMek = replyMessages[0];
            if (!replyMek?.message) return;

            const messageType = replyMek.message.conversation || replyMek.message.extendedTextMessage?.text;
            const isReplyToSentMsg = replyMek.message.extendedTextMessage?.contextInfo?.stanzaId === messageID;

            const replierNumber = (replyMek.key.participant || replyMek.key.remoteJid || '').split('@')[0].split(':')[0];
            const originalSenderNumber = (msg.key.participant || msg.key.remoteJid || '').split('@')[0].split(':')[0];
            const isSameUser = replierNumber === originalSenderNumber;
            const isSameChat = replyMek.key.remoteJid === chatJid;

            if (isReplyToSentMsg && isSameChat && isSameUser) {
                clearTimeout(cleanupTimeout);
                socket.ev.off('messages.upsert', handleSelection);

                const choice = parseInt(messageType) - 1;
                if (isNaN(choice) || choice < 0 || choice >= gameResults.length) {
                    await socket.sendMessage(chatJid, {
                        text: `*❪ INVALID ❫*\n\n⚠️ *Wrong Number!*\n🎯 *Range:* _01 - ${gameResults.length}_\n📝 _Please reply with a valid number!_${DEFAULT_FOOTER}`
                    }, { quoted: replyMek });
                    return;
                }

                const selectedItem = gameResults[choice];
                
                await socket.sendMessage(chatJid, { 
                    text: `*❪ FETCHING ❫*\n\n🎮 *Fetching Game Details...*\n⚡ _Please wait..._`
                }, { quoted: replyMek });

                let detailsResponse = null;
                let detailsRetries = 3;
                while (detailsRetries > 0 && !detailsResponse) {
                    try {
                        detailsResponse = await axios.get(`${API_BASE}/api/v1/movie/fitgirl/infodl?q=${encodeURIComponent(selectedItem.url)}&api_key=${API_KEY}`, { timeout: 120000 });
                    } catch (detailsErr) {
                        detailsRetries--;
                        if (detailsRetries === 0) {
                            throw detailsErr;
                        }
                        console.log(`Fitgirl details failed, retrying... (${detailsRetries} attempts left)`);
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    }
                }
                const detailsData = detailsResponse.data;

                try {
                    if (!detailsData.status || !detailsData.data) {
                        throw new Error('Failed to fetch game details');
                    }

                    const gameInfo = detailsData.data;
                    const categorized = gameInfo.categorizedLinks || {};
                    const validDownloads = [];

                    if (categorized.FuckingFast) {
                        categorized.FuckingFast.forEach(link => {
                            validDownloads.push({
                                name: `FuckingFast: ${link.label}`,
                                link: link.url
                            });
                        });
                    }
                    
                    if (validDownloads.length === 0) {
                        await socket.sendMessage(chatJid, {
                            text: `*❪ NO DOWNLOADS ❫*\n\n⚠️ *No Downloads Found!*\n😞 _There are no direct download parts available for this game!_${DEFAULT_FOOTER}`
                        }, { quoted: replyMek });
                        return;
                    }
                    
                    const specs = gameInfo.specifications || {};
                    const gameDetailsText = `*❪ GAME DETAILS ❫*\n\n🎮 *${gameInfo.gameTitle}*\n🎭 *Genres* ➜ ${gameInfo.genres || 'N/A'}\n🏢 *Company* ➜ ${gameInfo.companies || 'N/A'}\n🗣️ *Languages* ➜ ${gameInfo.languages ? (gameInfo.languages.length > 150 ? gameInfo.languages.substring(0, 150) + '...' : gameInfo.languages) : 'N/A'}\n💾 *Original Size* ➜ ${specs.originalSize || 'N/A'}\n📦 *Repack Size* ➜ ${specs.repackSize || 'N/A'}\n🗿 *Web* ➜ fitgirl-repacks.site${DEFAULT_FOOTER}`;

                    const gamePosterUrl = gameInfo.image || DEFAULT_IMAGE;
                    await socket.sendMessage(chatJid, {
                        image: { url: gamePosterUrl },
                        caption: gameDetailsText
                    }, { quoted: replyMek });

                    let downloadOptionsText = `*❪ GAME DOWNLOADS ❫*\n\n📥 *Select Mirror/Download Option:*\n\n*00* ➜ 📥 _Get ALL mirrors at once_\n`;
                    validDownloads.forEach((dl, i) => {
                        const num = getCircledNumber(i + 1);
                        downloadOptionsText += `${num} ➜ 🔗 _${dl.name}_\n`;
                    });
                    downloadOptionsText += `\n*💬 REPLY TO GET LINK 💬*\n📌 _Reply with the number or reply with 0 to get all links_${DEFAULT_FOOTER}`;

                    const downloadOptionsMsg = await socket.sendMessage(chatJid, { text: downloadOptionsText }, { quoted: replyMek });
                    const optionsMsgID = downloadOptionsMsg.key.id;

                    const dlCleanupTimeout = setTimeout(() => {
                        socket.ev.off('messages.upsert', handleDownloadEvent);
                        console.log(`[Fitgirl] Cleaned up stale download listener for msg ID: ${optionsMsgID}`);
                    }, 120000);

                    const handleDownloadEvent = async ({ messages: downloadMessages }) => {
                        const downloadMek = downloadMessages[0];
                        if (!downloadMek?.message) return;

                        const downloadChoice = (downloadMek.message.conversation || downloadMek.message.extendedTextMessage?.text || "").trim();
                        const isReplyToOptionsMsg = downloadMek.message.extendedTextMessage?.contextInfo?.stanzaId === optionsMsgID;

                        const dlReplierNumber = (downloadMek.key.participant || downloadMek.key.remoteJid || '').split('@')[0].split(':')[0];
                        const isSameDlUser = dlReplierNumber === originalSenderNumber;
                        const isSameDlChat = downloadMek.key.remoteJid === chatJid;

                        if (isReplyToOptionsMsg && isSameDlChat && isSameDlUser) {
                            clearTimeout(dlCleanupTimeout);
                            socket.ev.off('messages.upsert', handleDownloadEvent);
                            socket.ev.off('messages.upsert', handleSelection);
                            
                            // Send all parts directly to current chat
                            if (downloadChoice === '0' || downloadChoice === '00') {
                                await socket.sendMessage(chatJid, { react: { text: '📥', key: downloadMek.key } });
                                
                                await socket.sendMessage(chatJid, { 
                                    text: `*❪ DOWNLOADING ALL ❫*\n\n🎮 *Game:* _${gameInfo.gameTitle}_\n📊 *Total Parts:* _${validDownloads.length}_\n⚡ _Resolving and sending all download options directly to this chat one by one..._`
                                }, { quoted: downloadMek });

                                try {
                                    for (let i = 0; i < validDownloads.length; i++) {
                                        const dl = validDownloads[i];
                                        
                                        let directLink = null;
                                        let retries = 3;
                                        while (retries > 0 && !directLink) {
                                            try {
                                                // Resolve link using the new '?q=' parameter
                                                const resolveUrl = `${API_BASE}/api/v1/movie/fitgirl/resolve?q=${encodeURIComponent(dl.link)}&api_key=${API_KEY}`;
                                                const resolveRes = await axios.get(resolveUrl, { timeout: 120000 });
                                                directLink = resolveRes.data.direct_link;
                                            } catch (partErr) {
                                                retries--;
                                                if (retries === 0) {
                                                    console.error(`Error resolving part ${i + 1}:`, partErr);
                                                    await socket.sendMessage(chatJid, {
                                                        text: `⚠️ *Failed to resolve part ${i + 1}:* _${dl.name}_\n🚫 _Error:_ ${partErr.response?.data?.detail || partErr.message}`
                                                    }, { quoted: downloadMek });
                                                } else {
                                                    console.log(`Failed to resolve part ${i + 1}, retrying... (${retries} attempts left)`);
                                                    await new Promise(resolve => setTimeout(resolve, 3000));
                                                }
                                            }
                                        }

                                        if (directLink) {
                                            let fileName = `${gameInfo.gameTitle}.rar`;
                                            const matchBracket = dl.name.match(/\(([^)]+)\)/);
                                            if (matchBracket) {
                                                fileName = matchBracket[1];
                                            } else {
                                                try {
                                                    const urlObj = new URL(directLink);
                                                    const pathname = urlObj.pathname;
                                                    const lastPart = pathname.substring(pathname.lastIndexOf('/') + 1);
                                                    if (lastPart && lastPart.includes('.')) {
                                                        fileName = lastPart;
                                                    }
                                                } catch (e) {}
                                            }

                                            await socket.sendMessage(chatJid, {
                                                document: { url: directLink },
                                                mimetype: 'application/octet-stream',
                                                fileName: fileName,
                                                caption: `🎮 *${gameInfo.gameTitle}*\n📌 *Part (${i + 1}/${validDownloads.length}):* ${fileName}\n\n${DEFAULT_FOOTER}`
                                            });
                                        }
                                         
                                        await new Promise(resolve => setTimeout(resolve, 2500));
                                    }
                                     
                                    await socket.sendMessage(chatJid, { react: { text: '✅', key: downloadMek.key } });
                                     
                                } catch (err) {
                                    console.error("Error sending all links:", err);
                                }
                                return;
                            }

                            // Send a single choice
                            const choiceNum = parseInt(downloadChoice) - 1;
                            if (isNaN(choiceNum) || choiceNum < 0 || choiceNum >= validDownloads.length) {
                                await socket.sendMessage(chatJid, {
                                    text: `*❪ INVALID ❫*\n\n⚠️ *Wrong Number!*\n🎯 *Range:* _01 - ${validDownloads.length} (or 0 for all)_\n📝 _Please reply with a valid number!_${DEFAULT_FOOTER}`
                                }, { quoted: downloadMek });
                                return;
                            }

                            const selectedDownload = validDownloads[choiceNum];
                            await socket.sendMessage(chatJid, { react: { text: '⏳', key: downloadMek.key } });

                            let directLink = null;
                            let retries = 3;
                            while (retries > 0 && !directLink) {
                                try {
                                    // Resolve link using the new '?q=' parameter
                                    const resolveUrl = `${API_BASE}/api/v1/movie/fitgirl/resolve?q=${encodeURIComponent(selectedDownload.link)}&api_key=${API_KEY}`;
                                    const resolveRes = await axios.get(resolveUrl, { timeout: 120000 });
                                    directLink = resolveRes.data.direct_link;
                                } catch (downloadError) {
                                    retries--;
                                    if (retries === 0) {
                                        console.error('Download error:', downloadError);
                                        await socket.sendMessage(chatJid, {
                                            text: `*❪ ERROR ❫*\n\n❌ *Direct link resolution failed!*\n🚫 _${downloadError.response?.data?.detail || downloadError.message}_${DEFAULT_FOOTER}`
                                        }, { quoted: downloadMek });
                                    } else {
                                        await new Promise(resolve => setTimeout(resolve, 3000));
                                    }
                                }
                            }

                            if (directLink) {
                                try {
                                    let fileName = `${gameInfo.gameTitle}.rar`;
                                    const matchBracket = selectedDownload.name.match(/\(([^)]+)\)/);
                                    if (matchBracket) {
                                        fileName = matchBracket[1];
                                    } else {
                                        try {
                                            const urlObj = new URL(directLink);
                                            const pathname = urlObj.pathname;
                                            const lastPart = pathname.substring(pathname.lastIndexOf('/') + 1);
                                            if (lastPart && lastPart.includes('.')) {
                                                fileName = lastPart;
                                            }
                                        } catch (e) {}
                                    }

                                    await socket.sendMessage(chatJid, {
                                        document: { url: directLink },
                                        mimetype: 'application/octet-stream',
                                        fileName: fileName,
                                        caption: `🎮 *${gameInfo.gameTitle}*\n📌 *Part/File:* ${fileName}\n\n${DEFAULT_FOOTER}`
                                    });

                                    await socket.sendMessage(chatJid, { react: { text: '✅', key: downloadMek.key } });
                                } catch (sendErr) {
                                    console.error("Send file error:", sendErr);
                                }
                            }
                         }
                     };

                     socket.ev.on('messages.upsert', handleDownloadEvent);

                 } catch (detailsError) {
                     console.error('Details error:', detailsError);
                     await socket.sendMessage(chatJid, {
                         text: `*❪ ERROR ❫*\n\n❌ *Game Details Error!*\n🚫 _${detailsError.response?.data?.detail || detailsError.message}_${DEFAULT_FOOTER}`
                     }, { quoted: replyMek });
                     socket.ev.off('messages.upsert', handleSelection);
                 }
             }
         };

         socket.ev.on('messages.upsert', handleSelection);

     } catch (error) {
         console.error('Fitgirl command error:', error);
         await socket.sendMessage(chatJid, {
             text: `*❪ SYSTEM ERROR ❫*\n\n❌ *System Error!*\n🚫 _${error.message || 'Unknown error'}_\n\n🔄 _Please try again later..._${DEFAULT_FOOTER}`
         }, { quoted: msg });
     }
     
     break;
}
case 'movie':             
case 'm': {
    const DEFAULT_FOOTER = `\n\n> 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘 CINE HUB 🧚‍♂️\n> 🧬 ᴘᴏᴡᴇʀᴇᴅ ʙʏ 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD`;

    if (!args.length) {
        await socket.sendMessage(sender, {
            text: `*❪ ERROR ❫*\n\n⚠️ *Invalid Usage!*\n\n🎬 *Example:*\n• .movie avatar\n• .m game of thrones\n\n📝 _Please provide the Movie_ _or TV Series name!_${DEFAULT_FOOTER}`
        }, { quoted: msg });
        break;
    }

    const query = args.join(' ');
    await socket.sendMessage(sender, { 
        text: `*❪ SEARCHING ❫*\n\n🔍 *Searching across all sources...*\n⚡ _Please wait a moment._`
    });

    const API_BASE = "https://chama-movie-api.koyeb.app";
    const API_KEY = "chama_api_23c3e7ffb034f25cf474f6d7ac266f9b";
    const DEFAULT_IMAGE = "https://chama-movie-api.koyeb.app/assets/chama_logo-K0qFVJ-7.png";

    try {
        const sites = ["cinesubz", "sinhalasub", "thenkiri", "moviesublk", "baiscope", "cineru"];
        const promises = sites.map(site => 
            axios.get(`${API_BASE}/api/v1/movie/${site}/search?q=${encodeURIComponent(query)}&api_key=${API_KEY}`)
                .then(res => res.data.status && res.data.data ? res.data.data.map(item => ({ ...item, site })) : [])
                .catch(() => [])
        );

        const resultsArrays = await Promise.all(promises);
        
        // Interleave results from all sites so one site doesn't dominate the top list
        let results = [];
        const maxLen = Math.max(...resultsArrays.map(arr => arr.length), 0);
        for (let i = 0; i < maxLen; i++) {
            for (const arr of resultsArrays) {
                if (i < arr.length) {
                    results.push(arr[i]);
                }
            }
        }
        results = results.slice(0, 100);

        if (results.length === 0) {
            await socket.sendMessage(sender, {
                text: `*❪ NO RESULTS ❫*\n\n😞 *No Results Found!*\n\n🎬 *Query:* _${query}_\n💡 *Tip:* _Please check the spelling and try again!_${DEFAULT_FOOTER}`
            }, { quoted: msg });
            break;
        }

        let listText = `*❪ MULTI-SOURCE SEARCH RESULTS ❫*\n\n🎯 *Query:* _${query}_\n📊 *Results:* _${results.length} Items_\n\n*👇 SELECT A NUMBER 👇*\n\n`;

        results.forEach((item, index) => {
            const siteTag = item.site.toUpperCase();
            const typeIcon = item.type === 'tvshows' ? '📺' : '🎥';
            const num = (index + 1) < 10 ? `0${index + 1}` : `${index + 1}`;
            listText += `*${num}* ➜ ${typeIcon} [_${siteTag}_] _${item.title.substring(0, 25)}_\n`;
        });

        listText += `${DEFAULT_FOOTER}`;
        
        const sentMsg = await socket.sendMessage(sender, { text: listText }, { quoted: msg });
        const messageID = sentMsg.key.id;

        const handleSelection = async ({ messages: replyMessages }) => {
            const replyMek = replyMessages[0];
            if (!replyMek?.message) return;

            const messageType = replyMek.message.conversation || replyMek.message.extendedTextMessage?.text;
            const isReplyToSentMsg = replyMek.message.extendedTextMessage?.contextInfo?.stanzaId === messageID;

            if (isReplyToSentMsg && sender === replyMek.key.remoteJid) {
                const choice = parseInt(messageType) - 1;
                if (isNaN(choice) || choice < 0 || choice >= results.length) {
                    await socket.sendMessage(sender, {
                        text: `*❪ INVALID ❫*\n\n⚠️ *Wrong Number!*\n🎯 *Range:* _01 - ${results.length}_\n📝 _Please reply with a valid number!_${DEFAULT_FOOTER}`
                    }, { quoted: replyMek });
                    return;
                }

                const selectedItem = results[choice];
                const site = selectedItem.site;
                const isTvShow = selectedItem.type === 'tvshows';
                
                if (isTvShow) {
                    await socket.sendMessage(sender, { 
                        text: `*❪ FETCHING ❫*\n\n📺 *Fetching TV Series details from ${site.toUpperCase()}...*\n⚡ _Please wait..._`
                    }, { quoted: replyMek });

                    try {
                        const infoEndpoint = site === 'moviebox' ? 'info' : 'infodl';
                        const tvShowResponse = await axios.get(`${API_BASE}/api/v1/movie/${site}/${infoEndpoint}?q=${encodeURIComponent(selectedItem.link)}&api_key=${API_KEY}`);
                        const tvShowData = tvShowResponse.data;

                        if (!tvShowData.status || !tvShowData.data) {
                            throw new Error('Failed to fetch TV show details');
                        }

                        const tvInfo = tvShowData.data;
                        
                        let tvDetailsText = `*❪ TV SERIES DETAILS ❫*\n\n📺 *${tvInfo.title}*\n⭐ 𝗜ᴍᴅ𝗯 ➜ ★ ${tvInfo.rating || 'N/A'}\n📅 𝗬ᴇᴀʀ ➜ ${tvInfo.year || 'N/A'}\n⏳ 𝗥ᴜɴᴛɪᴍᴇ ➜ ${tvInfo.duration || 'N/A'}\n🌍 🇨🇴🇺🇳🇹🇷🇾 ➜ ${tvInfo.country || 'N/A'}\n🎭 𝗚𝗲𝗻𝗴𝗿𝗲𝘀 ➜ ${tvInfo.genres ? tvInfo.genres.join(', ') : 'N/A'}\n📝 𝗦𝘁𝗼𝗿𝘆 ➜ ${tvInfo.story ? (tvInfo.story.length > 250 ? tvInfo.story.substring(0, 250) + '...' : tvInfo.story) : 'N/A'}\n🗿 𝗦𝗼𝘂𝗿𝗰𝗲 ➜ ${site.toUpperCase()}\n\ ${DEFAULT_FOOTER}`;

                        const posterUrl = tvInfo.image || selectedItem.image || DEFAULT_IMAGE;
                        await socket.sendMessage(sender, {
                            image: { url: posterUrl },
                            caption: tvDetailsText
                        }, { quoted: replyMek });

                        const episodes = tvInfo.episodes || tvInfo.downloads || [];
                        if (episodes.length === 0) {
                            await socket.sendMessage(sender, {
                                text: `*❪ NO EPISODES ❫*\n\n⚠️ *No Episodes Found!*\n😞 _There are no episodes available for this series!_${DEFAULT_FOOTER}`
                            }, { quoted: replyMek });
                            return;
                        }

                        // AUTO DOWNLOAD ALL EPISODES
                        await socket.sendMessage(sender, { 
                            text: `*❪ DOWNLOAD EPISODES ❫*\n\n📺 *Series:* _${tvInfo.title}_\n🎬 *Episodes:* _${episodes.length}_\n⚡ _Starting download process..._${DEFAULT_FOOTER}`
                        }, { quoted: replyMek });

                        let successCount = 0;
                        let failCount = 0;

                        for (let i = 0; i < episodes.length; i++) {
                            const episode = episodes[i];
                            const epName = getEpisodeName(episode.episode_name || episode.name, episode.episode_url || episode.url || episode.link || '');
                            try {
                                await socket.sendMessage(sender, { 
                                    text: `*❪ DOWNLOADING ❫*\n\n🎥 *Episode:* _${epName}_\n📊 *Progress:* _${i + 1}/${episodes.length}_`
                                }, { quoted: replyMek });

                                const epUrl = episode.episode_url || episode.url || episode.link;

                                let downloadLink = null;
                                let sizeLabel = 'WEB-DL';

                                if (epUrl && (epUrl.includes('downloadwella.com') || epUrl.includes('wella') || epUrl.endsWith('.mkv') || epUrl.endsWith('.mp4'))) {
                                    downloadLink = epUrl;
                                    let sizeMatch = (episode.name || episode.episode_name || '').match(/\(([^)]+)\)/);
                                    if (sizeMatch) sizeLabel = sizeMatch[1];
                                } else {
                                    const infoEndpoint = site === 'moviebox' ? 'info' : 'infodl';
                                    const epDlRes = await axios.get(`${API_BASE}/api/v1/movie/${site}/${infoEndpoint}?q=${encodeURIComponent(epUrl)}&api_key=${API_KEY}`);
                                    const epDlData = epDlRes.data;
                                    const rawLinks = Array.isArray(epDlData.data) ? epDlData.data : (epDlData.data?.downloads || []);
                                    if (epDlData.status && rawLinks.length > 0) {
                                        const nonTelegramLinks = rawLinks.filter(link => 
                                            link.link && !link.link.includes('t.me') && !link.link.includes('telegram')
                                        );
                                        const finalLinkObj = nonTelegramLinks[0] || rawLinks[0];
                                        downloadLink = finalLinkObj.link;
                                        sizeLabel = finalLinkObj.size || finalLinkObj.quality || 'WEB-DL';
                                    }
                                }

                                if (downloadLink) {
                                    const sizeMB = parseSizeToMB(sizeLabel);
                                    if (sizeMB > 350) {
                                        await socket.sendMessage(sender, {
                                            text: `*⚠️ FILE TOO LARGE ⚠️*\n\n📺 *Series:* _${tvInfo.title}_\n📌 *Episode:* _${epName}_\n💾 *Size:* _${sizeLabel}_\n\n📌 _This episode exceeds the direct WhatsApp upload limit of 350MB. Please use the direct link below to download or stream it:_\n\n🔗 *Direct Link:* ${downloadLink}${DEFAULT_FOOTER}`
                                        }, { quoted: replyMek });
                                        successCount++;
                                    } else {
                                        const thumbBuffer = await getThumbnailBuffer(posterUrl);
                                        let ext = downloadLink.endsWith('.mkv') ? 'mkv' : 'mp4';

                                        await socket.sendMessage(sender, {
                                            document: { url: downloadLink },
                                            mimetype: ext === 'mkv' ? 'video/x-matroska' : 'video/mp4',
                                            fileName: `${tvInfo.title} - ${epName}.${ext}`,
                                            caption: `*📺 🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD 𝗦𝗘𝗥𝗜𝗘𝗦 📺*\n\n🎭 *Title:* ${tvInfo.title}\n📌 *Episode:* ${epName}\n📊 *Quality:* ${sizeLabel}\n\n${DEFAULT_FOOTER}`,
                                            jpegThumbnail: thumbBuffer
                                        }, { quoted: replyMek });
                                        
                                        successCount++;
                                    }
                                } else {
                                    failCount++;
                                }
                                
                                await new Promise(resolve => setTimeout(resolve, 2500));
                                
                            } catch (epError) {
                                console.error(`Error downloading episode:`, epError);
                                failCount++;
                            }
                        }
                        
                        await socket.sendMessage(sender, { 
                            text: `*❪ SUMMARY ❫*\n\n🎉 *Download Complete!*\n\n🎬 *Series:* _${tvInfo.title}_\n✅ *Success:* _${successCount} Episodes_\n❌ *Failed:* _${failCount} Episodes_${DEFAULT_FOOTER}`
                        }, { quoted: replyMek });

                        socket.ev.off('messages.upsert', handleSelection);
                        
                    } catch (tvShowError) {
                        console.error('TV Show error:', tvShowError);
                        await socket.sendMessage(sender, {
                            text: `*❪ API ERROR ❫*\n\n❌ *Failed to retrieve details from source!*\n⚠️ _Reason: The links could not be resolved by the API server (likely blocked or link expired)._\n\n💡 _Please try selecting another search result or try again later..._${DEFAULT_FOOTER}`
                        }, { quoted: replyMek });
                        socket.ev.off('messages.upsert', handleSelection);
                    }
                    
                } else {
                    // MOVIE FLOW
                    await socket.sendMessage(sender, { 
                        text: `*❪ FETCHING ❫*\n\n🎬 *Fetching Movie details from ${site.toUpperCase()}...*\n⚡ _Please wait..._`
                    }, { quoted: replyMek });

                    try {
                        const detailsResponse = await axios.get(`${API_BASE}/api/v1/movie/${site}/infodl?q=${encodeURIComponent(selectedItem.link)}&api_key=${API_KEY}`);
                        const detailsData = detailsResponse.data;

                        if (!detailsData.status || !detailsData.data) {
                            throw new Error('Failed to fetch details');
                        }

                        const movieInfo = detailsData.data;
                        const validDownloads = movieInfo.downloads || [];
                        
                        if (validDownloads.length === 0) {
                            await socket.sendMessage(sender, {
                                text: `*❪ NO DOWNLOADS ❫*\n\n⚠️ *No Downloads Found!*\n😞 _There are no downloads available for this movie!_${DEFAULT_FOOTER}`
                            }, { quoted: replyMek });
                            return;
                        }
                        
                        const movieDetailsText = `*❪ MOVIE DETAILS ❫*\n\n🎬 *${movieInfo.title}*\n⭐ 𝗜𝗠𝗗𝗕 ➜ ★ ${movieInfo.imdb || movieInfo.rating || 'N/A'}\n📅 𝗬𝗲𝗮𝗿 ➜ ${movieInfo.year || 'N/A'}\n⏳ 𝗗𝘂𝗿𝗮𝘁𝗶𝗼𝗻 ➜ ${movieInfo.duration || 'N/A'}\n🌍 🇨🇴🇺🇳🇹🇷🇾 ➜ ${movieInfo.country || 'N/A'}\n🎭 🇬𝗲𝗻𝗿𝗲𝘀 ➜ ${movieInfo.genres ? movieInfo.genres.join(', ') : 'N/A'}\n🏷️ 𝗟𝗮𝗻𝗴 ➜ ${movieInfo.language || movieInfo.tag || 'N/A'}\n🎬 𝗗𝗶𝗿𝗲𝗰𝘁𝗼𝗿 ➜ ${movieInfo.directors || movieInfo.director || 'N/A'}\n⭐ 𝗖𝗮𝘀𝘁 ➜ ${movieInfo.stars || 'N/A'}\n📝 𝗦𝘁𝗼𝗿𝘆 ➜ ${movieInfo.story ? (movieInfo.story.length > 250 ? movieInfo.story.substring(0, 250) + '...' : movieInfo.story) : 'N/A'}\n🗿 𝗦𝗼𝘂𝗿𝗰𝗲 ➜ ${site.toUpperCase()}\n\ ${DEFAULT_FOOTER}`;

                        const moviePosterUrl = movieInfo.image || selectedItem.image || DEFAULT_IMAGE;
                        await socket.sendMessage(sender, {
                            image: { url: moviePosterUrl },
                            caption: movieDetailsText
                        }, { quoted: replyMek });

                        const downloadOptionsText = `*❪ DOWNLOADS ❫*\n\n📥 *Select Quality:*\n\n${validDownloads.map((dl, i) => {
                            const num = (i + 1) < 10 ? `0${i + 1}` : `${i + 1}`;
                            const quality = dl.quality || dl.name || dl.title || 'Direct Download';
                            const qualityIcon = quality.includes('1080') ? '🔥' : quality.includes('720') ? '💎' : '📱';
                            return `*${num}* ➜ ${qualityIcon} _${quality}_ 💾 _${dl.size || 'N/A'}_`;
                        }).join('\n')}\n\n*💬 REPLY TO DOWNLOAD 💬*\n📌 _Reply with the number_${DEFAULT_FOOTER}`;

                        const dlSentMsg = await socket.sendMessage(sender, { text: downloadOptionsText }, { quoted: replyMek });
                        const dlMessageID = dlSentMsg.key.id;

                        const handleDownloadSelection = async ({ messages: dlReplyMessages }) => {
                            const dlReplyMek = dlReplyMessages[0];
                            if (!dlReplyMek?.message) return;

                            const dlChoiceText = dlReplyMek.message.conversation || dlReplyMek.message.extendedTextMessage?.text;
                            const isReplyToDlMsg = dlReplyMek.message.extendedTextMessage?.contextInfo?.stanzaId === dlMessageID;

                            if (isReplyToDlMsg && sender === dlReplyMek.key.remoteJid) {
                                const dlChoice = parseInt(dlChoiceText) - 1;
                                if (isNaN(dlChoice) || dlChoice < 0 || dlChoice >= validDownloads.length) {
                                    await socket.sendMessage(sender, {
                                        text: `*❪ INVALID ❫*\n\n⚠️ *Wrong Number!*\n🎯 *Range:* _01 - ${validDownloads.length}_\n📝 _Please reply with a valid number!_${DEFAULT_FOOTER}`
                                    }, { quoted: dlReplyMek });
                                    return;
                                }

                                const selectedDownload = validDownloads[dlChoice];
                                const dlQuality = selectedDownload.quality || selectedDownload.name || 'N/A';
                                
                                await socket.sendMessage(sender, { 
                                    text: `*❪ SENDING MOVIE ❫*\n\n📥 *Sending:* _${movieInfo.title}_
📊 *Quality:* _${dlQuality}_
💾 *Size:* _${selectedDownload.size || 'N/A'}_
⚡ _Uploading file to WhatsApp..._`
                                }, { quoted: dlReplyMek });

                                try {
                                    const thumbBuffer = await getThumbnailBuffer(moviePosterUrl);
                                    let ext = selectedDownload.link.endsWith('.mkv') ? 'mkv' : 'mp4';

                                    await socket.sendMessage(sender, {
                                        document: { url: selectedDownload.link },
                                        mimetype: ext === 'mkv' ? 'video/x-matroska' : 'video/mp4',
                                        fileName: `${movieInfo.title} (${dlQuality}).${ext}`,
                                        caption: `*🎬 🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD 𝗠𝗢𝗩𝗜𝗘 🎬*\n\n🎭 *Title:* ${movieInfo.title}\n🌟 *IMDB:* ${movieInfo.imdb || movieInfo.rating || 'N/A'}\n📅 *Year:* ${movieInfo.year || 'N/A'}\n📊 *Quality:* ${dlQuality}\n💾 *Size:* ${selectedDownload.size || 'N/A'}\n\n${DEFAULT_FOOTER}`,
                                        jpegThumbnail: thumbBuffer
                                    }, { quoted: dlReplyMek });
                                } catch (uploadErr) {
                                    await socket.sendMessage(sender, {
                                        text: `*❪ UPLOAD FAILED ❫*\n\n❌ *Failed to upload file directly!*\n🔗 *Direct Link:* ${selectedDownload.link}${DEFAULT_FOOTER}`
                                    }, { quoted: dlReplyMek });
                                }

                                socket.ev.off('messages.upsert', handleDownloadSelection);
                            }
                        };

                        socket.ev.on('messages.upsert', handleDownloadSelection);
                        socket.ev.off('messages.upsert', handleSelection);

                    } catch (movieDetailsError) {
                        console.error('Movie Details error:', movieDetailsError);
                        await socket.sendMessage(sender, {
                            text: `*❪ ERROR ❫*\n\n❌ *Movie Details Error!*\n🚫 _${movieDetailsError.message}_${DEFAULT_FOOTER}`
                        }, { quoted: replyMek });
                        socket.ev.off('messages.upsert', handleSelection);
                    }
                }
            }
        };

        socket.ev.on('messages.upsert', handleSelection);

    } catch (error) {
        console.error('Unified Movie search error:', error);
        await socket.sendMessage(sender, {
            text: `*❪ SYSTEM ERROR ❫*\n\n❌ *System Error!*\n🚫 _${error.message || 'Unknown error'}_

🔄 _Please try again later..._${DEFAULT_FOOTER}`
        }, { quoted: msg });
    }
    
    break;
}case 'sinhalasub':             
case 'ssub': {
    const DEFAULT_FOOTER = `\n\n> 🎭 🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD 🎭\n> 🧬 ᴘᴏᴡᴇʀᴇᴅ ʙʏ 🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD`;

    if (!args.length) {
        await socket.sendMessage(sender, {
            text: `*❪ ERROR ❫*\n\n⚠️ *Invalid Usage!*\n\n🎬 *Example:*\n• .sinhalasub avatar\n• .ssub breaking bad\n\n📝 _Please provide the Movie_ _or TV Series name!_${DEFAULT_FOOTER}`
        }, { quoted: msg });
        break;
    }

    const query = args.join(' ');
    await socket.sendMessage(sender, { 
        text: `*❪ SEARCHING ❫*\n\n🔍 *Searching Sinhalasub...*\n⚡ _Please wait a moment._`
    });

    const API_BASE = "https://chama-movie-api.koyeb.app";
    const API_KEY = "chama_api_23c3e7ffb034f25cf474f6d7ac266f9b";
    const DEFAULT_IMAGE = "https://chama-movie-api.koyeb.app/logo.png";

    try {
        const searchResponse = await axios.get(`${API_BASE}/api/v1/movie/sinhalasub/search?q=${encodeURIComponent(query)}&api_key=${API_KEY}`);
        const searchData = searchResponse.data;

        if (!searchData.status || !searchData.data || searchData.data.length === 0) {
            await socket.sendMessage(sender, {
                text: `*❪ NO RESULTS ❫*\n\n😞 *No Results Found!*\n\n🎬 *Query:* _${query}_\n💡 *Tip:* _Please check the spelling and try again!_${DEFAULT_FOOTER}`
            }, { quoted: msg });
            break;
        }

        const results = searchData.data.slice(0, 25);
        let listText = `*❪ SEARCH RESULTS ❫*\n\n🎯 *Query:* _${query}_\n📊 *Results:* _	ext ${results.length} Items_\n\n*👇 SELECT A NUMBER 👇*\n\n`;

        results.forEach((item, index) => {
            const typeIcon = item.type === 'tvshows' ? '📺' : '🎥';
            const num = (index + 1) < 10 ? `0${index + 1}` : `${index + 1}`;
            listText += `*${num}* ➜ ${typeIcon} _	ext ${item.title.substring(0, 30)}_\n`;
        });

        listText += `${DEFAULT_FOOTER}`;
        
        const sentMsg = await socket.sendMessage(sender, { text: listText }, { quoted: msg });
        const messageID = sentMsg.key.id;

        const handleSelection = async ({ messages: replyMessages }) => {
            const replyMek = replyMessages[0];
            if (!replyMek?.message) return;

            const messageType = replyMek.message.conversation || replyMek.message.extendedTextMessage?.text;
            const isReplyToSentMsg = replyMek.message.extendedTextMessage?.contextInfo?.stanzaId === messageID;

            if (isReplyToSentMsg && sender === replyMek.key.remoteJid) {
                const choice = parseInt(messageType) - 1;
                if (isNaN(choice) || choice < 0 || choice >= results.length) {
                    await socket.sendMessage(sender, {
                        text: `*❪ INVALID ❫*\n\n⚠️ *Wrong Number!*\n🎯 *Range:* _01 - ${results.length}_\n📝 _Please reply with a valid number!_${DEFAULT_FOOTER}`
                    }, { quoted: replyMek });
                    return;
                }

                const selectedItem = results[choice];
                const isTvShow = selectedItem.type === 'tvshows';
                
                if (isTvShow) {
                    await socket.sendMessage(sender, { 
                        text: `*❪ FETCHING ❫*\n\n📺 *Fetching TV Series...*\n⚡ _Please wait..._`
                    }, { quoted: replyMek });

                    try {
                        const tvShowResponse = await axios.get(`${API_BASE}/api/v1/movie/sinhalasub/tv/info?q=${encodeURIComponent(selectedItem.link)}&api_key=${API_KEY}`);
                        const tvShowData = tvShowResponse.data;

                        if (!tvShowData.status || !tvShowData.data) {
                            throw new Error('Failed to fetch TV show details');
                        }

                        const tvInfo = tvShowData.data;
                        
                        let tvDetailsText = `*❪ TV SERIES DETAILS ❫*\n\n📺 *${tvInfo.title}*\n⭐ 𝗜ᴍᴅ𝗯 ➜ ★ ${tvInfo.rating || 'N/A'}\n📅 𝗬ᴇᴀʀ ➜ ${tvInfo.year || 'N/A'}\n⏳ ➜ ${tvInfo.duration || 'N/A'}\n🌍 ➜ ${tvInfo.country || 'N/A'}\n🎭 🇬𝗲𝗻 genres ➜ ${tvInfo.genres ? tvInfo.genres.join(', ') : 'N/A'}\n🎬  ➜ ${tvInfo.director || 'N/A'}\n⭐ 𝗦ᴛᴀʀ𝘀: ${tvInfo.stars || 'N/A'}\n📝 𝗦ᴛ𝗼𝗿𝘆 ➜ ${tvInfo.story ? (tvInfo.story.length > 250 ? tvInfo.story.substring(0, 250) + '...' : tvInfo.story) : 'N/A'}\n🗿 👑 𝗪ᴇ🇧 ➜ sinhalasub.lk\n${DEFAULT_FOOTER}`;

                        const posterUrl = tvInfo.image || selectedItem.image || DEFAULT_IMAGE;
                        await socket.sendMessage(sender, {
                            image: { url: posterUrl },
                            caption: tvDetailsText
                        }, { quoted: replyMek });

                        // AUTO DOWNLOAD ALL EPISODES
                        await socket.sendMessage(sender, { 
                            text: `*❪ DOWNLOAD EPISODES ❫*\n\n📺 *Series:* _${tvInfo.title}_\n🎬 *Episodes:* _	ext ${tvInfo.episodes.length}_\n⚡ _Starting download process..._${DEFAULT_FOOTER}`
                        }, { quoted: replyMek });

                        let successCount = 0;
                        let failCount = 0;

                        for (let i = 0; i < tvInfo.episodes.length; i++) {
                            const episode = tvInfo.episodes[i];
                            const epName = episode.episode_name || 'Episode ' + (i+1);
                            try {
                                await socket.sendMessage(sender, { 
                                    text: `*❪ DOWNLOADING ❫*\n\n🎥 *Episode:* _${epName}_\n📊 *Progress:* _${i + 1}/${tvInfo.episodes.length}_`
                                }, { quoted: replyMek });

                                const epUrl = episode.episode_url || episode.url || episode.link;
                                const epDlRes = await axios.get(`${API_BASE}/api/v1/movie/sinhalasub/tv/dl?q=${encodeURIComponent(epUrl)}&api_key=${API_KEY}`);
                                const epDlData = epDlRes.data;

                                if (epDlData.status && epDlData.data && epDlData.data.length > 0) {
                                    const nonTelegramLinks = epDlData.data.filter(link => 
                                        link.link && !link.link.includes('t.me') && !link.link.includes('telegram')
                                    );
                                    const finalLinkObj = nonTelegramLinks[0] || epDlData.data[0];
                                    
                                    await socket.sendMessage(sender, {
                                        document: { url: finalLinkObj.link },
                                        mimetype: 'video/mp4',
                                        fileName: `${tvInfo.title} - ${epName}.mp4`,
                                        caption: `*📺 🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD 𝗦𝗘𝗥𝗜𝗘𝗦 📺*\n\n🎭 *Title:* ${tvInfo.title}\n📌 *Episode:* ${epName}\n📊 *Quality:* Direct MP4\n\n${DEFAULT_FOOTER}`
                                    }, { quoted: replyMek });
                                    
                                    successCount++;
                                } else {
                                    failCount++;
                                }
                                
                                await new Promise(resolve => setTimeout(resolve, 2500));
                                
                            } catch (epError) {
                                console.error(`Error downloading episode:`, epError);
                                failCount++;
                            }
                        }
                        
                        await socket.sendMessage(sender, { 
                            text: `*❪ SUMMARY ❫*\n\n🎉 *Download Complete!*\n\n🎬 *Series:* _${tvInfo.title}_\n✅ *Success:* _	ext ${successCount} Episodes_\n❌ *Failed:* _	ext ${failCount} Episodes_	ext ${DEFAULT_FOOTER}`
                        }, { quoted: replyMek });

                        socket.ev.off('messages.upsert', handleSelection);
                        
                    } catch (tvShowError) {
                        console.error('TV Show error:', tvShowError);
                        await socket.sendMessage(sender, {
                            text: `*❪ ERROR ❫*\n\n❌ *TV Details Error!*\n🚫 _${tvShowError.message}_${DEFAULT_FOOTER}`
                        }, { quoted: replyMek });
                        socket.ev.off('messages.upsert', handleSelection);
                    }
                    
                } else {
                    // MOVIE FLOW
                    await socket.sendMessage(sender, { 
                        text: `*❪ FETCHING ❫*\n\n🎬 *Fetching Movie...*\n⚡ _Please wait..._`
                    }, { quoted: replyMek });

                    try {
                        const detailsResponse = await axios.get(`${API_BASE}/api/v1/movie/sinhalasub/infodl?q=${encodeURIComponent(selectedItem.link)}&api_key=${API_KEY}`);
                        const detailsData = detailsResponse.data;

                        if (!detailsData.status || !detailsData.data) {
                            throw new Error('Failed to fetch details');
                        }

                        const movieInfo = detailsData.data;
                        const validDownloads = movieInfo.downloads || [];
                        
                        if (validDownloads.length === 0) {
                            await socket.sendMessage(sender, {
                                text: `*❪ NO DOWNLOADS ❫*\n\n⚠️ *No Downloads Found!*\n😞 _There are no downloads available for this movie!_${DEFAULT_FOOTER}`
                            }, { quoted: replyMek });
                            return;
                        }
                        
                        const movieDetailsText = `*❪ MOVIE DETAILS ❫*\n\n🎬 *${movieInfo.title}*\n⭐ 𝗜𝗠𝗗𝗕 ➜ ★ ${movieInfo.imdb || movieInfo.rating || 'N/A'}\n📅 𝗬𝗲𝗮𝗿 ➜ ${movieInfo.year || 'N/A'}\n⏳ 𝗗𝘂𝗿𝗮𝘁𝗶𝗼𝗻 ➜ ${movieInfo.duration || 'N/A'}\n🌍 🇨ᴏ🇺🇳🇹🇷🇾 ➜ ${movieInfo.country || 'N/A'}\n🎭 🇬𝗲𝗻 genres ➜ ${movieInfo.genres ? movieInfo.genres.join(', ') : 'N/A'}\n🏷️ ➜ ${movieInfo.language || 'N/A'}\n🎬  ➜ ${movieInfo.director || 'N/A'}\n⭐  ➜ ${movieInfo.stars || 'N/A'}\n📝  ➜ ${movieInfo.story ? (movieInfo.story.length > 250 ? movieInfo.story.substring(0, 250) + '...' : movieInfo.story) : 'N/A'}\n🗿 👑 𝗪ᴇ🇧 ➜ sinhalasub.lk\n${DEFAULT_FOOTER}`;

                        const moviePosterUrl = movieInfo.image || selectedItem.image || DEFAULT_IMAGE;
                        await socket.sendMessage(sender, {
                            image: { url: moviePosterUrl },
                            caption: movieDetailsText
                        }, { quoted: replyMek });

                        const downloadOptionsText = `*❪ DOWNLOADS ❫*\n\n📥 *Select Quality:*\n\n${validDownloads.map((dl, i) => {
                            const num = (i + 1) < 10 ? `0${i + 1}` : `${i + 1}`;
                            const quality = dl.quality || dl.name || dl.title || 'Direct Download';
                            const qualityIcon = quality.includes('1080') ? '🔥' : quality.includes('720') ? '💎' : '📱';
                            return `*${num}* ➜ ${qualityIcon} _${quality}_ 💾 _${dl.size || 'N/A'}_`;
                        }).join('\n')}\n\n*💬 REPLY TO DOWNLOAD 💬*\n📌 _Reply with the number_${DEFAULT_FOOTER}`;

                        const downloadOptionsMsg = await socket.sendMessage(sender, { text: downloadOptionsText }, { quoted: replyMek });
                        const optionsMsgID = downloadOptionsMsg.key.id;

                        const handleDownload = async ({ messages: downloadMessages }) => {
                            const downloadMek = downloadMessages[0];
                            if (!downloadMek?.message) return;

                            const downloadChoice = downloadMek.message.conversation || downloadMek.message.extendedTextMessage?.text;
                            const isReplyToOptionsMsg = downloadMek.message.extendedTextMessage?.contextInfo?.stanzaId === optionsMsgID;

                            if (isReplyToOptionsMsg && sender === downloadMek.key.remoteJid) {
                                const choiceNum = parseInt(downloadChoice) - 1;
                                
                                if (isNaN(choiceNum) || choiceNum < 0 || choiceNum >= validDownloads.length) {
                                    await socket.sendMessage(sender, {
                                        text: `*❪ INVALID ❫*\n\n⚠️ *Wrong Number!*\n🎯 *Range:* _01 - ${validDownloads.length}_\n📝 _Please reply with a valid number!_${DEFAULT_FOOTER}`
                                    }, { quoted: downloadMek });
                                    return;
                                }

                                const selectedDownload = validDownloads[choiceNum];
                                await socket.sendMessage(sender, { react: { text: '📥', key: downloadMek.key } });

                                try {
                                    const finalDirectLink = selectedDownload.link;

                                    await socket.sendMessage(sender, {
                                        document: { url: finalDirectLink },
                                        mimetype: 'video/mp4',
                                        fileName: `${movieInfo.title} - 	ext ${selectedDownload.quality}.mp4`,
                                        caption: `*🎬 🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD 𝗠𝗢𝗩𝗜𝗘 🎬*\n\n🎭 *Title:* ${movieInfo.title}\n🌟 *IMDB:* ${movieInfo.imdb || movieInfo.rating || 'N/A'}\n📅 *Year:* ${movieInfo.year || 'N/A'}\n📊 *Quality:* ${selectedDownload.quality}\n💾 *Size:* ${selectedDownload.size || 'N/A'}\n\n${DEFAULT_FOOTER}`
                                    }, { quoted: downloadMek });

                                    await socket.sendMessage(sender, { react: { text: '✅', key: downloadMek.key } });

                                } catch (downloadError) {
                                    console.error('Download link error:', downloadError);
                                    await socket.sendMessage(sender, {
                                        text: `*❪ ERROR ❫*\n\n❌ *Download Failed!*\n🚫 _${downloadError.message}_${DEFAULT_FOOTER}`
                                    }, { quoted: downloadMek });
                                } finally {
                                    socket.ev.off('messages.upsert', handleDownload);
                                    socket.ev.off('messages.upsert', handleSelection);
                                }
                            }
                        };

                        socket.ev.on('messages.upsert', handleDownload);

                    } catch (detailsError) {
                        console.error('Details error:', detailsError);
                        await socket.sendMessage(sender, {
                            text: `*❪ ERROR ❫*\n\n❌ *Movie Details Error!*\n🚫 _${detailsError.message}_${DEFAULT_FOOTER}`
                        }, { quoted: replyMek });
                        socket.ev.off('messages.upsert', handleSelection);
                    }
                }
            }
        };

        socket.ev.on('messages.upsert', handleSelection);

    } catch (error) {
        console.error('Sinhalasub command error:', error);
        await socket.sendMessage(sender, {
            text: `*❪ SYSTEM ERROR ❫*\n\n❌ *System Error!*\n🚫 _${error.message || 'Unknown error'}_

🔄 _Please try again later..._${DEFAULT_FOOTER}`
        }, { quoted: msg });
    }
    
    break;
}
case 'thenkiri':
case 'tkiri': {
    const DEFAULT_FOOTER = `\n\n> 🎭 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘 𝗖𝗜𝗡𝗘 𝗛𝗨𝗕 🎭\n> 🧬 ᴘᴏᴡᴇʀᴇᴅ ʙʏ 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD 🧚‍♂️`;

    if (!args.length) {
        await socket.sendMessage(sender, {
            text: `*❪ ERROR ❫*\n\n⚠️ *Invalid Usage!*\n\n🎬 *Example:*\n• .thenkiri avatar\n• .tkiri squid game\n\n📝 _Please provide the Movie_ _or TV Series name!_${DEFAULT_FOOTER}`
        }, { quoted: msg });
        break;
    }

    const query = args.join(' ');
    await socket.sendMessage(sender, { 
        text: `*❪ SEARCHING ❫*\n\n🔍 *Searching Thenkiri...*\n⚡ _Please wait a moment._`
    });

    const API_BASE = "https://chama-movie-api.koyeb.app";
    const API_KEY = "chama_api_23c3e7ffb034f25cf474f6d7ac266f9b";
    const DEFAULT_IMAGE = "https://chama-movie-api.koyeb.app/assets/chama_logo-K0qFVJ-7.png";

    try {
        const searchResponse = await axios.get(`${API_BASE}/api/v1/movie/thenkiri/search?q=${encodeURIComponent(query)}&api_key=${API_KEY}`);
        const searchData = searchResponse.data;

        if (!searchData.status || !searchData.data || searchData.data.length === 0) {
            await socket.sendMessage(sender, {
                text: `*❪ NO RESULTS ❫*\n\n😞 *No Results Found!*\n\n🎬 *Query:* _${query}_\n💡 *Tip:* _Please check the spelling and try again!_${DEFAULT_FOOTER}`
            }, { quoted: msg });
            break;
        }

        const results = searchData.data.slice(0, 25);
        let listText = `*❪ SEARCH RESULTS ❫*\n\n🎯 *Query:* _${query}_\n📊 *Results:* _${results.length} Items_\n\n*👇 SELECT A NUMBER 👇*\n\n`;

        results.forEach((item, index) => {
            const typeIcon = item.type === 'tvshows' ? '📺' : '🎥';
            const num = (index + 1) < 10 ? `0${index + 1}` : `${index + 1}`;
            listText += `*${num}* ➜ ${typeIcon} _${item.title.substring(0, 30)}_\n`;
        });

        listText += `${DEFAULT_FOOTER}`;
        
        const sentMsg = await socket.sendMessage(sender, { text: listText }, { quoted: msg });
        const messageID = sentMsg.key.id;

        const handleSelection = async ({ messages: replyMessages }) => {
            const replyMek = replyMessages[0];
            if (!replyMek?.message) return;

            const messageType = replyMek.message.conversation || replyMek.message.extendedTextMessage?.text;
            const isReplyToSentMsg = replyMek.message.extendedTextMessage?.contextInfo?.stanzaId === messageID;

            if (isReplyToSentMsg && sender === replyMek.key.remoteJid) {
                const choice = parseInt(messageType) - 1;
                if (isNaN(choice) || choice < 0 || choice >= results.length) {
                    await socket.sendMessage(sender, {
                        text: `*❪ INVALID ❫*\n\n⚠️ *Wrong Number!*\n🎯 *Range:* _01 - ${results.length}_\n📝 _Please reply with a valid number!_${DEFAULT_FOOTER}`
                    }, { quoted: replyMek });
                    return;
                }

                const selectedItem = results[choice];
                const isTvShow = selectedItem.type === 'tvshows';
                
                if (isTvShow) {
                    await socket.sendMessage(sender, { 
                        text: `*❪ FETCHING ❫*\n\n📺 *Fetching TV Series...*\n⚡ _Please wait..._`
                    }, { quoted: replyMek });

                    try {
                        const tvShowResponse = await axios.get(`${API_BASE}/api/v1/movie/thenkiri/tv/info?q=${encodeURIComponent(selectedItem.link)}&api_key=${API_KEY}`);
                        const tvShowData = tvShowResponse.data;

                        if (!tvShowData.status || !tvShowData.data) {
                            throw new Error('Failed to fetch TV show details');
                        }

                        const tvInfo = tvShowData.data;
                        
                        let tvDetailsText = `*❪ TV SERIES DETAILS ❫*\n\n📺 *${tvInfo.title}*\n⭐ 𝗜𝗺𝗱𝗯 ➜ ★ ${tvInfo.rating || 'N/A'}\n📅 𝗬𝗲𝗮𝗿 ➜ ${tvInfo.year || 'N/A'}\n⏳ 𝗗𝘂𝗿𝗮𝘁𝗶𝗼𝗻 ➜ ${tvInfo.duration || 'N/A'}\n🌍 𝗖𝗼ᴜɴ𝘁𝗿𝘆 ➜ ${tvInfo.country || 'N/A'}\n🎭 𝗚𝗲𝗻𝗿𝗲𝘀 ➜ ${tvInfo.genres ? tvInfo.genres.join(', ') : 'N/A'}\n📝 𝗦𝘁𝗼𝗿𝘆 ➜ ${tvInfo.story ? (tvInfo.story.length > 250 ? tvInfo.story.substring(0, 250) + '...' : tvInfo.story) : 'N/A'}\n🗿 𝗪𝗲𝗯 ➜ thenkiri.com\n ${DEFAULT_FOOTER}`;

                        const posterUrl = tvInfo.image || selectedItem.image || DEFAULT_IMAGE;
                        await socket.sendMessage(sender, {
                            image: { url: posterUrl },
                            caption: tvDetailsText
                        }, { quoted: replyMek });

                        const downloads = tvInfo.downloads || [];
                        if (downloads.length === 0) {
                            await socket.sendMessage(sender, {
                                text: `*❪ NO DOWNLOADS ❫*\n\n⚠️ *No Episodes Found!*\n😞 _There are no episodes available for this series!_${DEFAULT_FOOTER}`
                            }, { quoted: replyMek });
                            return;
                        }

                        // AUTO DOWNLOAD ALL EPISODES
                        await socket.sendMessage(sender, { 
                            text: `*❪ DOWNLOAD EPISODES ❫*\n\n📺 *Series:* _${tvInfo.title || selectedItem.title}_\n🎬 *Episodes:* _${downloads.length}_\n⚡ _Starting download process..._${DEFAULT_FOOTER}`
                        }, { quoted: replyMek });

                        let successCount = 0;
                        let failCount = 0;

                        for (let i = 0; i < downloads.length; i++) {
                            const episode = downloads[i];
                            const epName = getEpisodeName(episode.name, episode.link);
                            try {
                                await socket.sendMessage(sender, { 
                                    text: `*❪ DOWNLOADING ❫*\n\n🎥 *Episode:* _${epName}_\n📊 *Progress:* _${i + 1}/${downloads.length}_`
                                }, { quoted: replyMek });

                                if (episode.link) {
                                    const thumbBuffer = await getThumbnailBuffer(tvInfo.image || selectedItem.image || DEFAULT_IMAGE);
                                    let sizeMatch = episode.name.match(/\(([^)]+)\)/);
                                    let sizeLabel = sizeMatch ? sizeMatch[1] : 'WEB-DL';
                                    
                                    const epCaption = `🎬 *DOWNLOAD ${tvInfo.title || selectedItem.title}*\n\n` +
                                        `█▓▒░ 📺 TV SERIES ░▒▓█\n` +
                                        `[${epName} - ${sizeLabel}]\n\n` +
                                        `█▓▒░ 🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD ░▒▓█\n` +
                                        `█▓▒░ 🇵🇴🇼🇪🇷🇪🇩 🇧🇾 🇨🇭🇦🇲🇦 🇹🇪🇨🇭 ░▒▓█`;

                                    let ext = episode.link.endsWith('.mkv') ? 'mkv' : 'mp4';

                                    await socket.sendMessage(sender, {
                                        document: { url: episode.link },
                                        mimetype: ext === 'mkv' ? 'video/x-matroska' : 'video/mp4',
                                        fileName: `${tvInfo.title || selectedItem.title} - ${epName}.${ext}`,
                                        jpegThumbnail: thumbBuffer,
                                        caption: epCaption
                                    }, { quoted: replyMek });
                                    
                                    successCount++;
                                } else {
                                    failCount++;
                                }
                                
                                await new Promise(resolve => setTimeout(resolve, 2500));
                                
                            } catch (epError) {
                                console.error(`Error downloading episode:`, epError);
                                failCount++;
                            }
                        }
                        
                        await socket.sendMessage(sender, { 
                            text: `*❪ SUMMARY ❫*\n\n🎉 *Download Complete!*\n\n🎬 *Series:* _${tvInfo.title}_\n✅ *Success:* _${successCount} Episodes_\n❌ *Failed:* _${failCount} Episodes_${DEFAULT_FOOTER}`
                        }, { quoted: replyMek });

                        socket.ev.off('messages.upsert', handleSelection);
                        
                    } catch (tvShowError) {
                        console.error('TV Show error:', tvShowError);
                        await socket.sendMessage(sender, {
                            text: `*❪ ERROR ❫*\n\n❌ *TV Details Error!*\n🚫 _Error: ${tvShowError.message}_${DEFAULT_FOOTER}`
                        }, { quoted: replyMek });
                        socket.ev.off('messages.upsert', handleSelection);
                    }
                    
                } else {
                    // MOVIE FLOW
                    await socket.sendMessage(sender, { 
                        text: `*❪ FETCHING ❫*\n\n🎬 *Fetching Movie...*\n⚡ _Please wait..._`
                    }, { quoted: replyMek });

                    try {
                        const detailsResponse = await axios.get(`${API_BASE}/api/v1/movie/thenkiri/infodl?q=${encodeURIComponent(selectedItem.link)}&api_key=${API_KEY}`);
                        const detailsData = detailsResponse.data;

                        if (!detailsData.status || !detailsData.data) {
                            throw new Error('Failed to fetch details');
                        }

                        const movieInfo = detailsData.data;
                        const validDownloads = movieInfo.downloads || [];
                        
                        if (validDownloads.length === 0) {
                            await socket.sendMessage(sender, {
                                text: `*❪ NO DOWNLOADS ❫*\n\n⚠️ *No Downloads Found!*\n😞 _There are no downloads available for this movie!_${DEFAULT_FOOTER}`
                            }, { quoted: replyMek });
                            return;
                        }
                        
                        const movieDetailsText = `*❪ MOVIE DETAILS ❫*\n\n🎬 *${movieInfo.title}*\n⭐ 𝗜𝗠𝗗𝗕 ➜ ★ ${movieInfo.imdb || movieInfo.rating || 'N/A'}\n📅 𝗬𝗲𝗮𝗿 ➜ ${movieInfo.year || 'N/A'}\n⏳ 𝗗𝘂𝗿𝗮𝘁𝗶𝗼𝗻 ➜ ${movieInfo.duration || 'N/A'}\n🌍 𝗖𝗼ᴜɴ𝘁𝗿𝘆 ➜ ${movieInfo.country || 'N/A'}\n🎭 𝗚𝗲𝗻𝗿𝗲𝘀 ➜ ${movieInfo.genres ? movieInfo.genres.join(', ') : 'N/A'}\n🏷️ *Language:* ${movieInfo.language || movieInfo.tag || 'N/A'}\n🎬 *Director:* ${movieInfo.directors || movieInfo.director || 'N/A'}\n⭐ *Cast:* ${movieInfo.stars || 'N/A'}\n📝 *Story:* ${movieInfo.story ? (movieInfo.story.length > 250 ? movieInfo.story.substring(0, 250) + '...' : movieInfo.story) : 'N/A'}\n🗿 𝗪𝗲𝗯 ➜ thenkiri.com\n ${DEFAULT_FOOTER}`;

                        const moviePosterUrl = movieInfo.image || selectedItem.image || DEFAULT_IMAGE;
                        await socket.sendMessage(sender, {
                            image: { url: moviePosterUrl },
                            caption: movieDetailsText
                        }, { quoted: replyMek });

                        const downloadOptionsText = `*❪ DOWNLOADS ❫*\n\n📥 *Select Quality:*\n\n${validDownloads.map((dl, i) => {
    const num = (i + 1) < 10 ? `0${i + 1}` : `${i + 1}`;
    const quality = dl.quality || dl.name || dl.title || 'Direct Download';
    const qualityIcon = quality.includes('1080') ? '🔥' : quality.includes('720') ? '💎' : '📱';
    return `*${num}* ➜ ${qualityIcon} _${quality}_ 💾 _${dl.size || 'N/A'}_`;
}).join('\n')}\n\n*💬 REPLY TO DOWNLOAD 💬*\n📌 _Reply with the number_${DEFAULT_FOOTER}`;

                        const dlSentMsg = await socket.sendMessage(sender, { text: downloadOptionsText }, { quoted: replyMek });
                        const dlMessageID = dlSentMsg.key.id;

                        const handleDownloadSelection = async ({ messages: dlReplyMessages }) => {
                            const dlReplyMek = dlReplyMessages[0];
                            if (!dlReplyMek?.message) return;

                            const dlChoiceText = dlReplyMek.message.conversation || dlReplyMek.message.extendedTextMessage?.text;
                            const isReplyToDlMsg = dlReplyMek.message.extendedTextMessage?.contextInfo?.stanzaId === dlMessageID;

                            if (isReplyToDlMsg && sender === dlReplyMek.key.remoteJid) {
                                const dlChoice = parseInt(dlChoiceText) - 1;
                                if (isNaN(dlChoice) || dlChoice < 0 || dlChoice >= validDownloads.length) {
                                    await socket.sendMessage(sender, {
                                        text: `*❪ INVALID ❫*\n\n⚠️ *Wrong Number!*\n🎯 *Range:* _01 - ${validDownloads.length}_\n📝 _Please reply with a valid number!_${DEFAULT_FOOTER}`
                                    }, { quoted: dlReplyMek });
                                    return;
                                }

                                const selectedDownload = validDownloads[dlChoice];
                                const dlQuality = selectedDownload.quality || selectedDownload.name || 'N/A';
                                const sizeMB = parseSizeToMB(selectedDownload.size || dlQuality);

                                if (sizeMB > 350) {
                                    await socket.sendMessage(sender, {
                                        text: `*⚠️ FILE TOO LARGE ⚠️*\n\n🎬 *Movie:* _${movieInfo.title}_\n📊 *Quality:* _${dlQuality}_\n💾 *Size:* _${selectedDownload.size || 'N/A'}_\n\n📌 _This file exceeds the direct WhatsApp upload limit of 350MB. Please use the direct link below to download or stream it:_\n\n🔗 *Direct Link:* ${selectedDownload.link}${DEFAULT_FOOTER}`
                                    }, { quoted: dlReplyMek });
                                    socket.ev.off('messages.upsert', handleDownloadSelection);
                                    return;
                                }
                                
                                await socket.sendMessage(sender, { 
                                    text: `*❪ SENDING MOVIE ❫*\n\n📥 *Sending:* _${movieInfo.title}_\n📊 *Quality:* _${dlQuality}_\n💾 *Size:* _${selectedDownload.size || 'N/A'}_\n⚡ _Uploading file to WhatsApp..._`
                                }, { quoted: dlReplyMek });

                                try {
                                    const thumbBuffer = await getThumbnailBuffer(movieInfo.image || selectedItem.image || DEFAULT_IMAGE);
                                    const movieCaption = `🎬 *DOWNLOAD ${movieInfo.title}*\n\n` +
                                        `█▓▒░ 🎥 MOVIE ░▒▓█\n` +
                                        `[${dlQuality} - ${selectedDownload.size || 'N/A'}]\n\n` +
                                        `█▓▒░ 🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD ░▒▓█\n` +
                                        `█▓▒░ 🇵🇴🇼🇪🇷🇪🇩 🇧🇾 🇨🇭🇦🇲🇦 🇹🇪🇨🇭 ░▒▓█`;

                                    await socket.sendMessage(sender, {
                                        document: { url: selectedDownload.link },
                                        mimetype: 'video/mp4',
                                        fileName: `${movieInfo.title} (${dlQuality}).mp4`,
                                        jpegThumbnail: thumbBuffer,
                                        caption: movieCaption
                                    }, { quoted: dlReplyMek });
                                } catch (uploadErr) {
                                    await socket.sendMessage(sender, {
                                        text: `*❪ UPLOAD FAILED ❫*\n\n❌ *Failed to upload file directly!*\n🔗 *Direct Link:* ${selectedDownload.link}${DEFAULT_FOOTER}`
                                    }, { quoted: dlReplyMek });
                                }

                                socket.ev.off('messages.upsert', handleDownloadSelection);
                            }
                        };

                        socket.ev.on('messages.upsert', handleDownloadSelection);
                        socket.ev.off('messages.upsert', handleSelection);

                    } catch (movieDetailsError) {
                        console.error('Movie Details error:', movieDetailsError);
                        await socket.sendMessage(sender, {
                            text: `*❪ ERROR ❫*\n\n❌ *Movie Details Error!*\n🚫 _${movieDetailsError.message}_${DEFAULT_FOOTER}`
                        }, { quoted: replyMek });
                        socket.ev.off('messages.upsert', handleSelection);
                    }
                }
            }
        };

        socket.ev.on('messages.upsert', handleSelection);

    } catch (error) {
        console.error('Thenkiri command error:', error);
        await socket.sendMessage(sender, {
            text: `*❪ SYSTEM ERROR ❫*\n\n❌ *System Error!*\n🚫 _${error.message || 'Unknown error'}_\n\n🔄 _Please try again later..._${DEFAULT_FOOTER}`
        }, { quoted: msg });
    }
    
    break;
}
case 'cinesubz':             
case 'cinetv': {
    const DEFAULT_FOOTER = "\n\n> 🎭 🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD 🎭\n> 🧬 ᴘᴏᴡᴇʀᴇᴅ ʙʏ 🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD";

    if (!args.length) {
        await socket.sendMessage(sender, {
            text: "*❪ ERROR ❫*\n\n⚠️ *Invalid Usage!*\n\n🎬 *Example:*\n• .cinetv spider man\n• .cinesubz game of thrones\n\n📝 _Please provide the Movie_ _or TV Series name!_" + DEFAULT_FOOTER
        }, { quoted: msg });
        break;
    }

    const cinesubQuery = args.join(' ');
    await socket.sendMessage(sender, { 
        text: "*❪ SEARCHING ❫*\n\n🔍 *Searching Cinesubz...*\n⚡ _Please wait a moment._"
    });

    const API_BASE = "https://chama-movie-api.koyeb.app";
    const API_KEY = "chama_api_23c3e7ffb034f25cf474f6d7ac266f9b"; // ඔබේ API Key එක දාන්න
    const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500";

    try {
        const searchResponse = await axios.get(API_BASE + "/api/v1/movie/cinesubz/search?q=" + encodeURIComponent(cinesubQuery) + "&api_key=" + API_KEY);
        const searchData = searchResponse.data;

        if (!searchData.status || !searchData.data || searchData.data.length === 0) {
            await socket.sendMessage(sender, {
                text: "*❪ NO RESULTS ❫*\n\n😞 *No Results Found!*\n\n🎬 *Query:* _" + cinesubQuery + "_\n💡 *Tip:* _Please check the spelling and try again!_" + DEFAULT_FOOTER
            }, { quoted: msg });
            break;
        }

        const cinesubResults = searchData.data.slice(0, 25);
        let listText = "*❪ SEARCH RESULTS ❫*\n\n🎯 *Query:* _" + cinesubQuery + "_\n📊 *Results:* _" + cinesubResults.length + " Items_\n\n*👇 SELECT A NUMBER 👇*\n\n";

        cinesubResults.forEach((item, index) => {
            const typeIcon = item.type === 'tvshows' ? '📺' : '🎥';
            const num = (index + 1) < 10 ? "0" + (index + 1) : "" + (index + 1);
            listText += "*" + num + "* ➜ " + typeIcon + " _" + item.title.substring(0, 30) + "_\n";
        });

        listText += DEFAULT_FOOTER;
        
        const sentMsg = await socket.sendMessage(sender, { text: listText }, { quoted: msg });
        const messageID = sentMsg.key.id;

        const handleSelection = async ({ messages: replyMessages }) => {
            const replyMek = replyMessages[0];
            if (!replyMek?.message) return;

            const messageType = replyMek.message.conversation || replyMek.message.extendedTextMessage?.text;
            const isReplyToSentMsg = replyMek.message.extendedTextMessage?.contextInfo?.stanzaId === messageID;

            if (isReplyToSentMsg && sender === replyMek.key.remoteJid) {
                const choice = parseInt(messageType) - 1;
                if (isNaN(choice) || choice < 0 || choice >= cinesubResults.length) {
                    await socket.sendMessage(sender, {
                        text: "*❪ INVALID ❫*\n\n⚠️ *Wrong Number!*\n🎯 *Range:* _01 - " + cinesubResults.length + "_\n📝 _Please reply with a valid number!_" + DEFAULT_FOOTER
                    }, { quoted: replyMek });
                    return;
                }

                const selectedItem = cinesubResults[choice];
                const isTvShow = selectedItem.type === 'tvshows';
                
                if (isTvShow) {
                    await socket.sendMessage(sender, { 
                        text: "*❪ FETCHING ❫*\n\n📺 *Fetching TV Series...*\n⚡ _Please wait..._"
                    }, { quoted: replyMek });

                    try {
                        const tvShowResponse = await axios.get(API_BASE + "/api/v1/movie/cinesubz/tv/info?q=" + encodeURIComponent(selectedItem.link) + "&api_key=" + API_KEY);
                        const tvShowData = tvShowResponse.data;

                        if (!tvShowData.status || !tvShowData.data) {
                            throw new Error('Failed to fetch TV show details');
                        }

                        const tvInfo = tvShowData.data;
                        
                        let tvDetailsText = "*❪ TV SERIES DETAILS ❫*\n\n📺 *" + tvInfo.title + "*\n⭐ 𝗜ᴍᴅ𝗯 ➜ ★ " + (tvInfo.rating || 'N/A') + "\n📅 𝗬ᴇᴀʀ ➜ " + (tvInfo.year || 'N/A') + "\n⏳ 𝗥ᴜɴᴛɪᴍᴇ ➜ " + (tvInfo.duration || 'N/A') + "\n🌍 𝗖ᴏᴜɴ𝘁𝗿ʏ ➜ " + (tvInfo.country || 'N/A') + "\n🎭 𝗚𝗲𝗻 genres ➜ " + (tvInfo.genres ? tvInfo.genres.join(', ') : 'N/A') + "\n🎬 𝗗ɪʀᴇᴄᴛᴏʀ ➜ " + (tvInfo.directors || 'N/A') + "\n⭐ 𝗦ᴛᴀʀ𝘀: " + (tvInfo.stars || 'N/A') + "\n📝 𝗦𝘁𝗼𝗿𝘆 ➜ " + (tvInfo.story ? (tvInfo.story.length > 250 ? tvInfo.story.substring(0, 250) + '...' : tvInfo.story) : 'N/A') + "\n🗿 𝗪ᴇʙ ➜ cinesubz.com\n" + DEFAULT_FOOTER;

                        const posterUrl = tvInfo.image || selectedItem.image || DEFAULT_IMAGE;
                        await socket.sendMessage(sender, {
                            image: { url: posterUrl },
                            caption: tvDetailsText
                        }, { quoted: replyMek });

                        // AUTO DOWNLOAD ALL EPISODES
                        await socket.sendMessage(sender, { 
                            text: "*❪ DOWNLOAD EPISODES ❫*\n\n📺 *Series:* _" + tvInfo.title + "_\n🎬 *Episodes:* _" + tvInfo.episodes.length + "_\n⚡ _Starting download process..._" + DEFAULT_FOOTER
                        }, { quoted: replyMek });

                        let successCount = 0;
                        let failCount = 0;

                        for (let i = 0; i < tvInfo.episodes.length; i++) {
                            const episode = tvInfo.episodes[i];
                            try {
                                await socket.sendMessage(sender, { 
                                    text: "*❪ DOWNLOADING ❫*\n\n🎥 *Episode:* _" + episode.episode_name + "_\n📊 *Progress:* _" + (i + 1) + "/" + tvInfo.episodes.length + "_"
                                }, { quoted: replyMek });

                                const epDlRes = await axios.get(API_BASE + "/api/v1/movie/cinesubz/tv/dl?q=" + encodeURIComponent(episode.episode_url) + "&api_key=" + API_KEY);
                                const epDlData = epDlRes.data;

                                if (epDlData.status && epDlData.data && epDlData.data.length > 0) {
                                    const nonTelegramLinks = epDlData.data.filter(link => 
                                        link.link && !link.link.includes('t.me') && !link.link.includes('telegram')
                                    );
                                    const finalLinkObj = nonTelegramLinks[0] || epDlData.data[0];
                                    
                                    await socket.sendMessage(sender, {
                                        document: { url: finalLinkObj.link },
                                        mimetype: 'video/mp4',
                                        fileName: tvInfo.title + " - " + episode.episode_name + ".mp4",
                                        caption: "*❪ MOVIE ❫*\n\n🎭 *" + tvInfo.title + "*\n📌 *" + episode.episode_name + "*" + DEFAULT_FOOTER
                                    }, { quoted: replyMek });
                                    
                                    successCount++;
                                } else {
                                    failCount++;
                                }
                                
                                await new Promise(resolve => setTimeout(resolve, 2500));
                                
                            } catch (epError) {
                                console.error("Error downloading episode:", epError);
                                failCount++;
                            }
                        }
                        
                        await socket.sendMessage(sender, { 
                            text: "*❪ SUMMARY ❫*\n\n🎉 *Download Complete!*\n\n🎬 *Series:* _" + tvInfo.title + "_\n✅ *Success:* _" + successCount + " Episodes_\n❌ *Failed:* _" + failCount + " Episodes_" + DEFAULT_FOOTER
                        }, { quoted: replyMek });

                        socket.ev.off('messages.upsert', handleSelection);
                        
                    } catch (tvShowError) {
                        console.error('TV Show error:', tvShowError);
                        await socket.sendMessage(sender, {
                            text: "*❪ ERROR ❫*\n\n❌ *TV Details Error!*\n🚫 _" + tvShowError.message + "_" + DEFAULT_FOOTER
                        }, { quoted: replyMek });
                        socket.ev.off('messages.upsert', handleSelection);
                    }
                    
                } else {
                    // MOVIE FLOW
                    await socket.sendMessage(sender, { 
                        text: "*❪ FETCHING ❫*\n\n🎬 *Fetching Movie...*\n⚡ _Please wait..._"
                    }, { quoted: replyMek });

                    try {
                        const detailsResponse = await axios.get(API_BASE + "/api/v1/movie/cinesubz/infodl?q=" + encodeURIComponent(selectedItem.link) + "&api_key=" + API_KEY);
                        const detailsData = detailsResponse.data;

                        if (!detailsData.status || !detailsData.data) {
                            throw new Error('Failed to fetch details');
                        }

                        const movieInfo = detailsData.data;
                        const validDownloads = movieInfo.downloads || [];
                        
                        if (validDownloads.length === 0) {
                            await socket.sendMessage(sender, {
                                text: "*❪ NO DOWNLOADS ❫*\n\n⚠️ *No Downloads Found!*\n😞 _There are no downloads available for this movie!_" + DEFAULT_FOOTER
                            }, { quoted: replyMek });
                            return;
                        }
                        
                        const movieDetailsText = "*❪ MOVIE DETAILS ❫*\n\n🎬 *" + movieInfo.title + "*\n⭐ 𝗜𝗠𝗗𝗕 ➜ ★ " + (movieInfo.imdb || movieInfo.rating || 'N/A') + "\n📅 𝗬𝗲𝗮𝗿 ➜ " + (movieInfo.year || 'N/A') + "\n⏳ 𝗗𝘂𝗿𝗮𝘁𝗶𝗼𝗻 ➜ " + (movieInfo.duration || 'N/A') + "\n🌍 𝗖ᴏᴜɴ𝘁𝗿ʏ ➜ " + (movieInfo.country || 'N/A') + "\n🎭 𝗚𝗲𝗻 genres ➜ " + (movieInfo.genres ? movieInfo.genres.join(', ') : 'N/A') + "\n🏷️  ➜ " + (movieInfo.language || movieInfo.tag || 'N/A') + "\n🎬  ➜ " + (movieInfo.directors || movieInfo.director || 'N/A') + "\n⭐  ➜ " + (movieInfo.stars || 'N/A') + "\n📝  ➜ " + (movieInfo.story ? (movieInfo.story.length > 250 ? movieInfo.story.substring(0, 250) + '...' : movieInfo.story) : 'N/A') + "\n🗿 𝗪ᴇʙ ➜ cinesubz.com\n" + DEFAULT_FOOTER;

                        const moviePosterUrl = movieInfo.image || selectedItem.image || DEFAULT_IMAGE;
                        await socket.sendMessage(sender, {
                            image: { url: moviePosterUrl },
                            caption: movieDetailsText
                        }, { quoted: replyMek });

                        const downloadOptionsText = "*❪ DOWNLOADS ❫*\n\n📥 *Select Quality:*\n\n" + validDownloads.map((dl, i) => {
                            const num = (i + 1) < 10 ? "0" + (i + 1) : "" + (i + 1);
                            const quality = dl.quality || dl.name || dl.title || 'Direct Download';
                            const qualityIcon = quality.includes('1080') ? '🔥' : quality.includes('720') ? '💎' : '📱';
                            return "*" + num + "* ➜ " + qualityIcon + " _" + quality + "_ 💾 _" + (dl.size || 'N/A') + "_";
                        }).join('\n') + "\n\n*💬 REPLY TO DOWNLOAD 💬*\n📌 _Reply with the number_" + DEFAULT_FOOTER;

                        const downloadOptionsMsg = await socket.sendMessage(sender, { text: downloadOptionsText }, { quoted: replyMek });
                        const optionsMsgID = downloadOptionsMsg.key.id;

                        const handleDownload = async ({ messages: downloadMessages }) => {
                            const downloadMek = downloadMessages[0];
                            if (!downloadMek?.message) return;

                            const downloadChoice = downloadMek.message.conversation || downloadMek.message.extendedTextMessage?.text;
                            const isReplyToOptionsMsg = downloadMek.message.extendedTextMessage?.contextInfo?.stanzaId === optionsMsgID;

                            if (isReplyToOptionsMsg && sender === downloadMek.key.remoteJid) {
                                const choiceNum = parseInt(downloadChoice) - 1;
                                
                                if (isNaN(choiceNum) || choiceNum < 0 || choiceNum >= validDownloads.length) {
                                    await socket.sendMessage(sender, {
                                        text: "*❪ INVALID ❫*\n\n⚠️ *Wrong Number!*\n🎯 *Range:* _01 - " + validDownloads.length + "_\n📝 _Please reply with a valid number!_" + DEFAULT_FOOTER
                                    }, { quoted: downloadMek });
                                    return;
                                }

                                const selectedDownload = validDownloads[choiceNum];
                                await socket.sendMessage(sender, { react: { text: '📥', key: downloadMek.key } });

                                try {
                                    const finalDirectLink = selectedDownload.link;

                                    await socket.sendMessage(sender, {
                                        document: { url: finalDirectLink },
                                        mimetype: 'video/mp4',
                                        fileName: movieInfo.title + " - " + selectedDownload.quality + ".mp4",
                                        caption: "*❪ MOVIE ❫*\n\n🎭 *" + movieInfo.title + "*\n📌 *Quality:* _" + selectedDownload.quality + "_\n💾 *Size:* _" + selectedDownload.size + "_" + DEFAULT_FOOTER
                                    }, { quoted: downloadMek });

                                    await socket.sendMessage(sender, { react: { text: '✅', key: downloadMek.key } });

                                } catch (downloadError) {
                                    console.error('Download link error:', downloadError);
                                    await socket.sendMessage(sender, {
                                        text: "*❪ ERROR ❫*\n\n❌ *Download Failed!*\n🚫 _" + downloadError.message + "_" + DEFAULT_FOOTER
                                    }, { quoted: downloadMek });
                                } finally {
                                    socket.ev.off('messages.upsert', handleDownload);
                                    socket.ev.off('messages.upsert', handleSelection);
                                }
                            }
                        };

                        socket.ev.on('messages.upsert', handleDownload);

                    } catch (detailsError) {
                        console.error('Details error:', detailsError);
                        await socket.sendMessage(sender, {
                            text: "*❪ ERROR ❫*\n\n❌ *Movie Details Error!*\n🚫 _" + detailsError.message + "_" + DEFAULT_FOOTER
                        }, { quoted: replyMek });
                        socket.ev.off('messages.upsert', handleSelection);
                    }
                }
            }
        };

        socket.ev.on('messages.upsert', handleSelection);

    } catch (error) {
        console.error('Cinesubz command error:', error);
        await socket.sendMessage(sender, {
            text: "*❪ SYSTEM ERROR ❫*\n\n❌ *System Error!*\n🚫 _" + (error.message || 'Unknown error') + "_\n\n🔄 _Please try again later..._" + DEFAULT_FOOTER
        }, { quoted: msg });
    }
    
    break;
}
case 'lakvision':             
case 'lak': {
    const DEFAULT_FOOTER = `\n\n> 📺 🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD 𝗟𝗔🇰𝗩𝗜𝗦𝗜𝗢𝗡 📺\n> 🧬 ᴘᴏᴡᴇʀᴇᴅ ʙʏ 🇨🇭𝗔𝗠𝗔 𝗧𝗘𝗖𝗛`;
    const from = sender;

    if (!args.length) {
        await socket.sendMessage(from, {
            text: `*❪ ERROR ❫*\n\n⚠️ *Invalid Usage!*\n\n📺 *Example:*\n• .lakvision rathu chooti\n• .lak sewanali\n\n📝 _Please provide the Teledrama or Video name!_${DEFAULT_FOOTER}`
        }, { quoted: msg });
        break;
    }

    const lakQuery = args.join(' ');
    await socket.sendMessage(from, { react: { text: '🔍', key: msg.key } });
    await socket.sendMessage(from, { 
        text: `*❪ SEARCHING ❫*\n\n🔍 *Searching LakvisionTV...*\n⚡ _Please wait a moment._`
    }, { quoted: msg });

    const API_BASE = "https://chama-movie-api.koyeb.app";
    const API_KEY = "chama_api_2e93b415af83f521e819edf637005681";
    const DEFAULT_IMAGE = "https://chama-movie-api.koyeb.app/logo.png";

    try {
        const searchResponse = await axios.get(`${API_BASE}/api/v1/movie/lakvision/search?q=${encodeURIComponent(lakQuery)}&api_key=${API_KEY}`);
        const searchData = searchResponse.data;

        if (!searchData.status || !searchData.data || searchData.data.length === 0) {
            await socket.sendMessage(from, {
                text: `*❪ NO RESULTS ❫*\n\n😞 *No Results Found!*\n\n🎬 *Query:* _${lakQuery}_\n💡 *Tip:* _Please check the spelling and try again!_${DEFAULT_FOOTER}`
            }, { quoted: msg });
            break;
        }

        const lakResults = searchData.data.slice(0, 25);
        let listText = `*❪ LAKVISION SEARCH RESULTS ❫*\n\n🎯 *Query:* _${lakQuery}_\n📊 *Results:* _${lakResults.length} Items_\n\n*👇 SELECT A NUMBER 👇*\n\n`;

        lakResults.forEach((item, index) => {
            const num = (index + 1) < 10 ? `0${index + 1}` : `${index + 1}`;
            listText += `*${num}* ➜ 📺 _${item.title.substring(0, 35)}_\n`;
        });

        listText += `${DEFAULT_FOOTER}`;
        
        await socket.sendMessage(from, { text: listText }, { quoted: msg });

        const reply = await waitForReply(from, (body) => {
            const num = parseInt(body) - 1;
            return !isNaN(num) && num >= 0 && num < lakResults.length;
        });

        if (!reply) break;
        let mm = reply.m;
        const choice = parseInt(reply.body) - 1;
        const selectedItem = lakResults[choice];

        await socket.sendMessage(from, { react: { text: '⏳', key: mm.key } });
        await socket.sendMessage(from, { 
            text: `*❪ FETCHING ❫*\n\n📺 *Fetching Video Details and MP4 Download Links...*\n⚡ _Please wait..._`
        }, { quoted: mm });

        const detailsResponse = await axios.get(`${API_BASE}/api/v1/movie/lakvision/infodl?q=${encodeURIComponent(selectedItem.link)}&api_key=${API_KEY}`);
        const detailsData = detailsResponse.data;

        if (!detailsData.status || !detailsData.data) {
            await socket.sendMessage(from, { text: `❌ *Failed to fetch video details!*` }, { quoted: mm });
            break;
        }

        const videoInfo = detailsData.data;
        const validDownloads = videoInfo.downloads || [];

        if (validDownloads.length === 0) {
            await socket.sendMessage(from, {
                text: `*❪ NO DOWNLOADS ❫*\n\n⚠️ *No Streams Found!*\n😞 _There are no direct download streams available for this video!_${DEFAULT_FOOTER}`
            }, { quoted: mm });
            break;
        }

        const videoDetailsText = `*❪ LAKVISION VIDEO DETAILS ❫*\n\n📺 *${videoInfo.title}*\n🗣️ 𝗟𝗮𝗻𝗴𝘂𝗮𝗴𝗲 ➜ ${videoInfo.language || 'Sinhala'}\n🎭 𝗚𝗲𝗻𝗿𝗲 ➜ ${videoInfo.genres ? videoInfo.genres.join(', ') : 'Teledrama'}\n🗿 𝗪ᴇ🇧 ➜ lakvisiontv.net`;

        let downloadsListText = videoDetailsText + `\n\n*👇 SELECT A STREAM / DOWNLOAD OPTION 👇*\n\n`;
        validDownloads.forEach((dl, i) => {
            const num = (i + 1) < 10 ? `0${i + 1}` : `${i + 1}`;
            downloadsListText += `*${num}* ➜ 🎥 _${dl.name || dl.title || `Option ${i + 1}`}_\n`;
        });
        downloadsListText += `${DEFAULT_FOOTER}`;

        const posterUrl = videoInfo.image || selectedItem.image || DEFAULT_IMAGE;

        await socket.sendMessage(from, {
            image: { url: posterUrl },
            caption: downloadsListText
        }, { quoted: mm }).catch(() => {});

        const optReply = await waitForReply(from, (body) => {
            const num = parseInt(body) - 1;
            return !isNaN(num) && num >= 0 && num < validDownloads.length;
        });

        if (!optReply) break;
        mm = optReply.m;
        const selectedDownload = validDownloads[parseInt(optReply.body) - 1];

        let finalDirectLink = selectedDownload.link || selectedDownload.url || '';
        if (finalDirectLink.includes('youtube.com/watch?v=')) {
            const ytMatch = finalDirectLink.match(/v=([a-zA-Z0-9_-]+)/);
            if (ytMatch) finalDirectLink = `https://www.youtube.com/watch?v=${ytMatch[1]}`;
        }

        await socket.sendMessage(from, { react: { text: '⏳', key: mm.key } });
        await socket.sendMessage(from, {
            text: `*❪ DOWNLOADING ❫*\n\n🎬 *Sending Direct MP4 Video...*\n⚡ _Please wait a moment..._${DEFAULT_FOOTER}`
        }, { quoted: mm });

        let jpegThumbnail = undefined;
        try {
            const thumbRes = await axios.get(posterUrl, { responseType: 'arraybuffer' });
            jpegThumbnail = Buffer.from(thumbRes.data).toString('base64');
        } catch (err) {}

        const fileName = `${videoInfo.title || 'lakvision_video'}.mp4`;
        let sent = false;

        // Tier 1: Direct URL document upload with jpegThumbnail
        try {
            await socket.sendMessage(from, {
                document: { url: finalDirectLink },
                mimetype: 'video/mp4',
                fileName,
                caption: `*📺 🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD 𝗟𝗔🇰𝗩𝗜𝗦𝗜𝗢𝗡 📺*\n\n🎭 *Title:* ${videoInfo.title}\n\n${DEFAULT_FOOTER}`,
                jpegThumbnail
            }, { quoted: mm });
            sent = true;
        } catch (e1) {
            // Tier 2: Server-side download fallback
            const tempFilePath = `./temp_lakvision_${Date.now()}.mp4`;
            try {
                const downloadCmd = `yt-dlp --no-playlist --no-check-certificates -f "b/best[height<=720]/bestvideo[height<=720]+bestaudio/best" -o "${tempFilePath}" "${finalDirectLink}"`;
                await new Promise((resolve, reject) => {
                    exec(downloadCmd, { timeout: 180000 }, (err) => (err || !fs.existsSync(tempFilePath)) ? reject(err) : resolve());
                });

                if (fs.existsSync(tempFilePath)) {
                    await socket.sendMessage(from, {
                        document: { url: tempFilePath },
                        mimetype: 'video/mp4',
                        fileName,
                        caption: `*📺 🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD 𝗟𝗔🇰𝗩𝗜𝗦𝗜𝗢𝗡 📺*\n\n🎭 *Title:* ${videoInfo.title}\n\n${DEFAULT_FOOTER}`,
                        jpegThumbnail
                    }, { quoted: mm });
                    sent = true;
                }
            } catch (e2) {} finally {
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            }
        }

        // Tier 3: Direct Link Fallback
        if (!sent) {
            await socket.sendMessage(from, {
                text: `📌 *Direct Video Stream Link:*\n${finalDirectLink}`
            }, { quoted: mm });
        }

        await socket.sendMessage(from, { react: { text: '✅', key: mm.key } });

    } catch (error) {
        console.error('Lakvision command error:', error);
        await socket.sendMessage(from, {
            text: `*❪ SYSTEM ERROR ❫*\n\n❌ *System Error!*\n🚫 _${error.message || 'Unknown error'}_\n\n🔄 _Please try again later..._${DEFAULT_FOOTER}`
        }, { quoted: msg });
    }
    break;
}
case 'hanime':             
case 'hhentai': {
    const DEFAULT_FOOTER = `\n\n> 🔞 🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD 𝗛𝗔𝗡𝗜𝗠𝗘 𝗛𝗨𝗕 🔞\n> 🧬 ᴘᴏᴡᴇʀᴇᴅ ʙʏ 🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD`;
    const from = sender;

    if (!args.length) {
        await socket.sendMessage(from, {
            text: `*❪ ERROR ❫*\n\n⚠️ *Invalid Usage!*\n\n🔞 *Example:*\n• .hanime overflow\n• .hhentai paihame\n\n📝 _Please provide the Hanime title!_${DEFAULT_FOOTER}`
        }, { quoted: msg });
        break;
    }

    const hQuery = args.join(' ');
    await socket.sendMessage(from, { react: { text: '🔍', key: msg.key } });
    await socket.sendMessage(from, { 
        text: `*❪ SEARCHING ❫*\n\n🔍 *Searching Hanime.tv...*\n⚡ _Please wait a moment._`
    }, { quoted: msg });

    const API_BASE = "https://chama-movie-api.koyeb.app";
    const API_KEY = "chama_api_2e93b415af83f521e819edf637005681";
    const DEFAULT_IMAGE = "https://chama-movie-api.koyeb.app/assets/chama_logo-K0qFVJ-7.png";

    try {
        const searchResponse = await axios.get(`${API_BASE}/api/v1/movie/hanime/search?q=${encodeURIComponent(hQuery)}&api_key=${API_KEY}`);
        const searchData = searchResponse.data;

        if (!searchData.status || !searchData.data || searchData.data.length === 0) {
            await socket.sendMessage(from, {
                text: `*❪ NO RESULTS ❫*\n\n😞 *No Results Found!*\n\n🎬 *Query:* _${hQuery}_\n💡 *Tip:* _Please check the spelling and try again!_${DEFAULT_FOOTER}`
            }, { quoted: msg });
            break;
        }

        const hResults = searchData.data.slice(0, 25);
        let listText = `*❪ HANIME SEARCH RESULTS ❫*\n\n🎯 *Query:* _${hQuery}_\n📊 *Results:* _${hResults.length} Items_\n\n*👇 REPLY WITH A NUMBER 👇*\n\n`;

        hResults.forEach((item, index) => {
            const num = (index + 1) < 10 ? `0${index + 1}` : `${index + 1}`;
            listText += `*${num}* ➜ 🔞 _${item.title.substring(0, 40)}_\n`;
        });

        listText += `${DEFAULT_FOOTER}`;
        
        await socket.sendMessage(from, { text: listText }, { quoted: msg });

        const reply = await waitForReply(from, (body) => {
            const num = parseInt(body) - 1;
            return !isNaN(num) && num >= 0 && num < hResults.length;
        });

        if (!reply) break;
        let mm = reply.m;
        const choice = parseInt(reply.body) - 1;
        const selectedItem = hResults[choice];

        await socket.sendMessage(from, { react: { text: '⏳', key: mm.key } });
        await socket.sendMessage(from, { 
            text: `*❪ FETCHING ❫*\n\n🔞 *Fetching Hanime details for "${selectedItem.title}"...*\n⚡ _Please wait a moment..._`
        }, { quoted: mm });

        const detailsResponse = await axios.get(`${API_BASE}/api/v1/movie/hanime/infodl?q=${encodeURIComponent(selectedItem.link)}&api_key=${API_KEY}`);
        const detailsData = detailsResponse.data;

        if (!detailsData.status || !detailsData.data) {
            await socket.sendMessage(from, { text: `❌ *Failed to fetch video details!*` }, { quoted: mm });
            break;
        }

        const videoInfo = detailsData.data;
        const validDownloads = videoInfo.downloads || [];

        if (validDownloads.length === 0) {
            await socket.sendMessage(from, {
                text: `*❪ NO DOWNLOADS ❫*\n\n⚠️ *No Downloads Found!_${DEFAULT_FOOTER}`
            }, { quoted: mm });
            break;
        }

        const videoDetailsText = `*❪ HANIME VIDEO DETAILS ❫*\n\n🔞 *${videoInfo.title}*\n⭐ 𝗥𝗮𝘁𝗶𝗻𝗴 ➜ ★ ${videoInfo.rating || 'N/A'}\n📅 𝗬𝗲𝗮𝗿 ➜ ${videoInfo.year || 'N/A'}\n🌍 𝗖ᴏᴜɴ𝘁𝗿ʏ ➜ ${videoInfo.country || 'N/A'}\n🎭 𝗚𝗲𝗻𝗿𝗲𝘀 ➜ ${videoInfo.genres ? videoInfo.genres.join(', ') : 'N/A'}\n📝 𝗦𝘁𝗼𝗿𝘆 ➜ ${videoInfo.story ? (videoInfo.story.length > 250 ? videoInfo.story.substring(0, 250) + '...' : videoInfo.story) : 'N/A'}\n${DEFAULT_FOOTER}`;
        const posterUrl = videoInfo.image || selectedItem.image || DEFAULT_IMAGE;

        await socket.sendMessage(from, {
            image: { url: posterUrl },
            caption: videoDetailsText
        }, { quoted: mm }).catch(() => {});

        let selectedDownload = validDownloads[0];

        if (validDownloads.length > 1) {
            let downloadsListText = `*❪ HANIME DOWNLOAD OPTIONS ❫*\n\n👇 *Select Download Option:*\n\n`;
            validDownloads.forEach((dl, index) => {
                const num = (index + 1) < 10 ? `0${index + 1}` : `${index + 1}`;
                downloadsListText += `*${num}* ➜ 🎬 _${dl.title || dl.name || `Option ${index + 1}`}_\n`;
            });
            downloadsListText += `\n*👇 REPLY WITH A NUMBER 👇*${DEFAULT_FOOTER}`;

            await socket.sendMessage(from, { text: downloadsListText }, { quoted: mm });
            const dlReply = await waitForReply(from, (body) => {
                const num = parseInt(body) - 1;
                return !isNaN(num) && num >= 0 && num < validDownloads.length;
            });

            if (!dlReply) break;
            mm = dlReply.m;
            selectedDownload = validDownloads[parseInt(dlReply.body) - 1];
        }

        const finalDirectLink = selectedDownload.link || selectedDownload.url || '';
        await socket.sendMessage(from, { react: { text: '⏳', key: mm.key } });
        await socket.sendMessage(from, {
            text: `*❪ DOWNLOADING ❫*\n\n🎬 *Sending Video File...*\n⚡ _Please wait a moment..._${DEFAULT_FOOTER}`
        }, { quoted: mm });

        const fileName = `${videoInfo.title || 'hanime_video'}.mp4`;
        let sent = false;

        // Tier 1: Direct URL document stream
        try {
            await socket.sendMessage(from, {
                document: { url: finalDirectLink },
                mimetype: 'video/mp4',
                fileName,
                caption: `*🔞 🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD 🔞*\n\n🎭 *Title:* ${videoInfo.title || 'Hanime Video'}\n\n${DEFAULT_FOOTER}`
            }, { quoted: mm });
            sent = true;
        } catch (e1) {
            // Tier 2: Local temp download fallback
            const tempFilePath = `./temp_hanime_${Date.now()}.mp4`;
            try {
                const downloadCmd = `yt-dlp --no-playlist --no-check-certificates -f "b/best[height<=720]/bestvideo[height<=720]+bestaudio/best" -o "${tempFilePath}" "${finalDirectLink}"`;
                await new Promise((resolve, reject) => {
                    exec(downloadCmd, { timeout: 180000 }, (err) => (err || !fs.existsSync(tempFilePath)) ? reject(err) : resolve());
                });

                if (fs.existsSync(tempFilePath)) {
                    await socket.sendMessage(from, {
                        document: { url: tempFilePath },
                        mimetype: 'video/mp4',
                        fileName,
                        caption: `*🔞 🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD 🔞*\n\n🎭 *Title:* ${videoInfo.title || 'Hanime Video'}\n\n${DEFAULT_FOOTER}`
                    }, { quoted: mm });
                    sent = true;
                }
            } catch (e2) {} finally {
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            }
        }

        // Tier 3: Direct Link Fallback
        if (!sent) {
            await socket.sendMessage(from, {
                text: `📌 *Direct Video Stream Link:*\n${finalDirectLink}`
            }, { quoted: mm });
        }

        await socket.sendMessage(from, { react: { text: '✅', key: mm.key } });

    } catch (error) {
        console.error('Hanime command error:', error);
        await socket.sendMessage(from, {
            text: `*❪ SYSTEM ERROR ❫*\n\n❌ *System Error!*\n🚫 _${error.message || 'Unknown error'}_\n\n🔄 _Please try again later..._${DEFAULT_FOOTER}`
        }, { quoted: msg });
    }
    break;
}
case 'cxxx':
case 'cadult':
case 'adult':
case 'adultsearch':
case 'xnxx':
case 'xvideos':
case 'pornhub':
case 'youporn':
case 'xhamster':
case 'redtube':
case 'spankbang':
case 'eporner':
case 'tube8':
case 'tnaflix':
case 'drtuber':
case 'porntrex':
case 'beeg':
case 'thumbzilla':
case 'rule34':
case 'e621':
case 'gelbooru':
case 'hclips':
case 'tuporn':
case 'javuncensored':
case 'pornone':
case 'hentaihaven':
case 'xtube': {
    const DEFAULT_FOOTER = `\n\n> 🔞 🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD 𝗔𝗗𝗨𝗟𝗧 𝗠𝗘𝗗𝗜𝗔 𝗡𝗘𝗧𝗪𝗢𝗥𝗞 🔞\n> 🧬 ᴘᴏᴡᴇʀᴇᴅ ʙʏ 🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD`;
    const from = sender;
    const API_BASE = "https://chama-movie-api.koyeb.app";
    const API_KEY = "chama_api_2e93b415af83f521e819edf637005681";

    let siteKey = command;
    let siteName = command.toUpperCase();
    let apiPath = `/api/adult/${command}/search`;

    if (['adult', 'cadult', 'cxxx', 'adultsearch'].includes(command)) {
        siteKey = 'all';
        siteName = '22-SITE MEGA NETWORK';
        apiPath = '/api/adult/all/search';
    }

    if (!args.length) {
        await socket.sendMessage(from, {
            text: `*❪ 🔞 ADULT MEDIA ENGINE ❫*\n\n⚠️ *Invalid Usage!*\n\n🔞 *Examples:*\n• .cxxx 120363408929003946@g.us college\n• .xnxx teen\n• .adult anime\n\n📝 _Specify a keyword, or pass a target JID + keyword to forward directly!_${DEFAULT_FOOTER}`
        }, { quoted: msg });
        break;
    }

    let targetJid = from;
    let queryArgs = [...args];

    let firstArg = queryArgs[0];
    if (firstArg && (firstArg.endsWith('@g.us') || firstArg.endsWith('@newsletter') || firstArg.endsWith('@s.whatsapp.net') || firstArg.includes('whatsapp.com/channel/'))) {
        if (firstArg.includes('whatsapp.com/channel/')) {
            const inviteCode = firstArg.split('whatsapp.com/channel/')[1].split('/')[0].split('?')[0];
            try {
                const metadata = await socket.newsletterMetadata('invite', inviteCode);
                targetJid = metadata.id;
            } catch (err) {}
        } else {
            targetJid = firstArg;
        }
        queryArgs.shift();
    }

    if (!queryArgs.length) {
        await socket.sendMessage(from, {
            text: `⚠️ *Please provide a search keyword!*${DEFAULT_FOOTER}`
        }, { quoted: msg });
        break;
    }

    const query = queryArgs.join(' ');
    await socket.sendMessage(from, { react: { text: '🔞', key: msg.key } });
    await socket.sendMessage(from, { 
        text: `*❪ SEARCHING ❫*\n\n🔍 *Searching ${siteName}...*\n⚡ _Please wait a moment._`
    }, { quoted: msg });

    try {
        const endpoint = `${API_BASE}${apiPath}?q=${encodeURIComponent(query)}&page=1&api_key=${API_KEY}`;
        const res = await axios.get(endpoint);
        const resultsData = res.data.results || res.data.data || [];

        if (!resultsData || resultsData.length === 0) {
            await socket.sendMessage(from, {
                text: `😞 *No adult videos found for "${query}"!*${DEFAULT_FOOTER}`
            }, { quoted: msg });
            break;
        }

        const results = resultsData.slice(0, 15);
        let txt = `*🔞 ❪ ${siteName} SEARCH RESULTS ❫*\n\n🎯 *Query:* _${query}_\n📊 *Total Found:* _${results.length} Videos_\n\n*👇 REPLY WITH A NUMBER 👇*\n\n`;

        results.forEach((v, i) => {
            const num = (i + 1) < 10 ? `0${i + 1}` : `${i + 1}`;
            txt += `*${num}* ➜ 🎥 _${(v.title || 'Adult Video').substring(0, 40)}_\n⏱️ *Duration:* _${v.duration || 'N/A'}_ | 🌐 *Site:* _${(v.site || siteKey).toUpperCase()}_\n\n`;
        });

        txt += DEFAULT_FOOTER;

        const sentMsg = await socket.sendMessage(from, { text: txt }, { quoted: msg });

        const reply = await waitForReply(from, (body) => {
            const num = parseInt(body) - 1;
            return !isNaN(num) && num >= 0 && num < results.length;
        });

        if (!reply) break;
        const mm = reply.m;
        const numChoice = parseInt(reply.body) - 1;
        const selectedItem = results[numChoice];
        const targetSite = selectedItem.site || siteKey || 'xnxx';

        await socket.sendMessage(from, { react: { text: '⏳', key: mm.key } });
        await socket.sendMessage(from, {
            text: `📥 *[${numChoice + 1}] Extracting MP4 Video for "${selectedItem.title}"...*\n⚡ _Please wait a moment..._${DEFAULT_FOOTER}`
        }, { quoted: mm });

        // Try /dl API endpoint first for direct stream URL extraction
        let streamProxyUrl = `${API_BASE}/api/adult/stream?url=${encodeURIComponent(selectedItem.url)}&site=${targetSite}&dl=True&api_key=${API_KEY}`;
        try {
            const dlApiUrl = `${API_BASE}/api/adult/${targetSite}/dl?url=${encodeURIComponent(selectedItem.url)}&api_key=${API_KEY}`;
            const dlRes = await axios.get(dlApiUrl, { timeout: 10000 });
            if (dlRes.data && (dlRes.data.direct_link || dlRes.data.link || (dlRes.data.downloads && dlRes.data.downloads.length > 0))) {
                const direct = dlRes.data.direct_link || dlRes.data.link || (dlRes.data.downloads[0] && dlRes.data.downloads[0].link);
                if (direct) streamProxyUrl = direct;
            }
        } catch (dlErr) {}

        let sent = false;

        // Tier 1: Direct Video stream message
        try {
            await socket.sendMessage(targetJid, {
                video: { url: streamProxyUrl },
                caption: `🎬 *${selectedItem.title}*\n⏱️ *Duration:* ${selectedItem.duration || 'N/A'}\n🌐 *Network:* ${targetSite.toUpperCase()}\n\n${DEFAULT_FOOTER}`,
                mimetype: 'video/mp4'
            });
            sent = true;
        } catch (e1) {
            // Tier 2: Server-side temp file download fallback
            const tempFilePath = `./temp_adult_${Date.now()}.mp4`;
            try {
                const downloadCmd = `yt-dlp --no-playlist --no-check-certificates -f "b/best[height<=720]/bestvideo[height<=720]+bestaudio/best" -o "${tempFilePath}" "${streamProxyUrl}"`;
                await new Promise((resolve, reject) => {
                    exec(downloadCmd, { timeout: 180000 }, (err) => (err || !fs.existsSync(tempFilePath)) ? reject(err) : resolve());
                });

                if (fs.existsSync(tempFilePath)) {
                    await socket.sendMessage(targetJid, {
                        video: { url: tempFilePath },
                        caption: `🎬 *${selectedItem.title}*\n⏱️ *Duration:* ${selectedItem.duration || 'N/A'}\n🌐 *Network:* ${targetSite.toUpperCase()}\n\n${DEFAULT_FOOTER}`,
                        mimetype: 'video/mp4'
                    });
                    sent = true;
                }
            } catch (e2) {} finally {
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            }
        }

        // Tier 3: Direct Link Fallback
        if (!sent) {
            await socket.sendMessage(targetJid, {
                text: `📌 *Direct MP4 Video Stream Link:*\n${streamProxyUrl}`
            });
        }

        if (targetJid !== from) {
            await socket.sendMessage(from, { text: `✅ *Video sent/forwarded successfully to target JID:* _${targetJid}_` }, { quoted: mm });
        }

        await socket.sendMessage(from, { react: { text: '✅', key: mm.key } });

    } catch (err) {
        console.error('Adult search command error:', err);
        await socket.sendMessage(from, {
            text: `❌ *Adult Search Error:* _${err.message || 'Unknown error'}_${DEFAULT_FOOTER}`
        }, { quoted: msg });
    }
    break;
}

case 'pinterest':
case 'pin': {
    const DEFAULT_FOOTER = `\n\n> 📌 🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD 𝗣𝗜𝗡𝗧𝗘𝗥𝗘𝗦𝗧 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥 📌\n> 🧬 ᴘᴏᴡᴇʀᴇᴅ ʙʏ 🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD`;
    const from = sender;
    const API_BASE = "https://chama-movie-api.koyeb.app";
    const API_KEY = "chama_api_2e93b415af83f521e819edf637005681";

    if (!args.length) {
        await socket.sendMessage(from, {
            text: `*❪ PINTEREST DOWNLOADER & SEARCH ❫*\n\n⚠️ *Invalid Usage!*\n\n📌 *Examples:*\n• .pinterest https://www.pinterest.com/pin/861313497495034608/\n• .pin Sultan Suleiman\n\n📝 _Paste a Pinterest Pin link to download or type keywords to search!_${DEFAULT_FOOTER}`
        }, { quoted: msg });
        break;
    }

    const query = args.join(' ').trim();

    if (query.includes('pinterest.com/pin/') || query.includes('pin.it/')) {
        await socket.sendMessage(from, { react: { text: '📌', key: msg.key } });
        await socket.sendMessage(from, { 
            text: `*❪ DOWNLOADING MEDIA ❫*\n\n⏳ *Extracting 4K Original Media & MP4 Video...*\n⚡ _Please wait a moment._`
        }, { quoted: msg });

        try {
            const res = await axios.get(`${API_BASE}/api/v1/pinterest/infodl?q=${encodeURIComponent(query)}&api_key=${API_KEY}`);
            if (res.data.status && res.data.data) {
                const pin = res.data.data;
                const downloads = pin.downloads || [];

                let caption = `*📌 ❪ PINTEREST MEDIA EXTRACTED ❫*\n\n`;
                caption += `🎬 *Title:* ${pin.title || 'Pinterest Pin'}\n`;
                caption += `📸 *Quality:* 4K Ultra HD Original\n\n`;
                caption += `*👇 DOWNLOAD OPTIONS 👇*\n\n`;

                downloads.forEach((dl, i) => {
                    caption += `*${i + 1}.* ${dl.name || `Option ${i + 1}`}\n🔗 ${dl.link}\n\n`;
                });
                caption += DEFAULT_FOOTER;

                await socket.sendMessage(from, {
                    image: { url: pin.image },
                    caption: caption
                }, { quoted: msg });

            } else {
                await socket.sendMessage(from, { text: `❌ *Failed to extract Pinterest Pin media!*${DEFAULT_FOOTER}` }, { quoted: msg });
            }
        } catch (err) {
            console.error('Pinterest download error:', err);
            await socket.sendMessage(from, { text: `⚠️ *Error resolving Pinterest link!*${DEFAULT_FOOTER}` }, { quoted: msg });
        }
    } else {
        await socket.sendMessage(from, { react: { text: '🔍', key: msg.key } });
        await socket.sendMessage(from, { 
            text: `*❪ SEARCHING PINTEREST ❫*\n\n🔍 *Searching pins for:* _${query}_\n⚡ _Please wait a moment._`
        }, { quoted: msg });

        try {
            const res = await axios.get(`${API_BASE}/api/v1/pinterest/search?q=${encodeURIComponent(query)}&api_key=${API_KEY}`);
            if (res.data.status && res.data.data && res.data.data.length > 0) {
                const results = res.data.data.slice(0, 10);
                let text = `*❪ PINTEREST SEARCH RESULTS ❫*\n\n🎯 *Query:* _${query}_\n📊 *Total Found:* _${results.length} Pins_\n\n`;

                results.forEach((item, index) => {
                    text += `*${index + 1}.* ${item.title || 'Pinterest Pin'}\n🔗 ${item.link}\n\n`;
                });
                text += `💡 *Tip:* _Copy any pin link above and send_ \`.pin <link>\` _to get 4K download!_${DEFAULT_FOOTER}`;

                await socket.sendMessage(from, { text: text }, { quoted: msg });
            } else {
                await socket.sendMessage(from, { text: `😞 *No Pinterest Pins found for "${query}"!*${DEFAULT_FOOTER}` }, { quoted: msg });
            }
        } catch (err) {
            console.error('Pinterest search error:', err);
            await socket.sendMessage(from, { text: `⚠️ *Error searching Pinterest!*${DEFAULT_FOOTER}` }, { quoted: msg });
        }
    }
    break;
}

case 'suleiman':
case 'magnificent': {
    const DEFAULT_FOOTER = `\n\n> 👑 𝗦𝗨𝗟𝗘𝗜𝗠𝗔𝗡 𝗖𝗜𝗡𝗘𝗠𝗔 𝗦𝗘𝗔𝗥𝗖𝗛 👑\n> 🧬 ᴘᴏᴡᴇʀᴇᴅ ʙʏ 🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD`;
    const from = sender;
    const API_BASE = "https://chama-movie-api.koyeb.app";
    const API_KEY = "chama_api_2e93b415af83f521e819edf637005681";

    const searchQuery = args.length ? args.join(' ') : "Suleiman";
    
    await socket.sendMessage(from, { react: { text: '👑', key: msg.key } });
    await socket.sendMessage(from, { 
        text: `*❪ SEARCHING SULEIMAN ❫*\n\n🔍 *Searching Suleiman Teledrama & Movies...*\n⚡ _Please wait a moment._`
    }, { quoted: msg });

    try {
        const sites = ["cinesubz", "sinhalasub", "baiscope", "cineru", "subz"];
        const promises = sites.map(site => 
            axios.get(`${API_BASE}/api/v1/movie/${site}/search?q=${encodeURIComponent(searchQuery)}&api_key=${API_KEY}`)
                .then(res => res.data.status && res.data.data ? res.data.data.map(item => ({ ...item, site })) : [])
                .catch(() => [])
        );

        const resultsArrays = await Promise.all(promises);
        const results = resultsArrays.flat().slice(0, 15);

        if (results.length === 0) {
            await socket.sendMessage(from, {
                text: `*❪ NO RESULTS ❫*\n\n😞 *No Suleiman results found!*\n\n🎬 *Query:* _${searchQuery}_${DEFAULT_FOOTER}`
            }, { quoted: msg });
            break;
        }

        let listText = `*👑 ❪ SULEIMAN MULTI-SOURCE SEARCH ❫*\n\n🎯 *Query:* _${searchQuery}_\n📊 *Results Found:* _${results.length} Items_\n\n`;

        results.forEach((item, index) => {
            listText += `*${index + 1}.* ${item.title}\n`;
            listText += `   🌐 *Source:* ${item.site.toUpperCase()}\n`;
            listText += `   🔗 *Link:* ${item.link}\n\n`;
        });

        listText += `💡 *Tip:* _Send \`.cmovie <targetJid> <movie_name>\` or \`.movie <name>\` to download!_${DEFAULT_FOOTER}`;

        await socket.sendMessage(from, { text: listText }, { quoted: msg });
    } catch (err) {
        console.error('Suleiman search error:', err);
        await socket.sendMessage(from, { text: `⚠️ *Error searching Suleiman media!*${DEFAULT_FOOTER}` }, { quoted: msg });
    }
    break;
}

case 'addreact': {
    if (!isOwner) return reply("❌ අනේ සුදූ, මේ කමාන්ඩ් එක පාවිච්චි කරන්න පුළුවන් ownerට විතරයි... 🥺");
    if (!args.length) {
        await socket.sendMessage(sender, {
            text: `*❪ ERROR ❫*\n\n⚠️ *Invalid Usage!*\n\n📝 *Format:* \`.addreact [Channel_Link_or_JID] [Emojis (optional, comma-separated)]\`\n\n🎬 *Example:* \`.addreact https://whatsapp.com/channel/0029VaXxxxx ❤️,🔥,👍\`\n\n_If no emojis are specified, ❤️ 🔥 😍 👍 will be used._`
        }, { quoted: msg });
        break;
    }
    
    let input = args[0];
    let inviteCode = null;
    let channelJid = null;
    
    if (input.includes('whatsapp.com/channel/')) {
        inviteCode = input.split('whatsapp.com/channel/')[1].split('/')[0].split('?')[0];
    } else if (input.endsWith('@newsletter')) {
        channelJid = input;
    } else {
        await socket.sendMessage(sender, {
            text: `❌ *Invalid Channel Link or JID!*`
        }, { quoted: msg });
        break;
    }
    
    await socket.sendMessage(sender, { text: `⏳ *Connecting to Channel and fetching metadata...*` });
    
    try {
        let channelName = 'WhatsApp Channel';
        if (inviteCode) {
            const metadata = await socket.newsletterMetadata('invite', inviteCode);
            channelJid = metadata.id;
            channelName = metadata.name || channelName;
        }
        
        if (!channelJid) {
            throw new Error("Could not resolve Channel JID.");
        }
        
        // Auto follow
        await socket.newsletterFollow(channelJid).catch(() => {});
        
        // Parse Emojis
        let emojis = ['❤️', '🔥', '😍', '👍'];
        if (args[1]) {
            emojis = args[1].split(',').map(e => e.trim()).filter(e => e.length > 0);
        }
        
        const botNumber = socket.user.id.split(':')[0];
        await AutoReact.findOneAndUpdate(
            { botNumber, channelJid },
            { botNumber, channelJid, channelName, inviteCode, emojis },
            { upsert: true }
        );
        
        // Invalidate channel auto-react cache
        autoReactCache.del(`${botNumber}_${channelJid}`);
        
        await socket.sendMessage(sender, {
            text: `✅ *Auto React Configured Successfully!*\n\n📢 *Channel:* _${channelName}_\n📌 *JID:* _${channelJid}_\n✨ *Emojis:* _${emojis.join(' ')}_\n\n_Auto React is now active for this channel!_`
        }, { quoted: msg });
        
    } catch (error) {
        console.error(error);
        await socket.sendMessage(sender, {
            text: `❌ *Failed to configure Auto React!*\n🚫 _Error: ${error.message}_`
        }, { quoted: msg });
    }
    break;
}
case 'delreact': {
    if (!isOwner) return reply("❌ අනේ සුදූ, මේ කමාන්ඩ් එක පාවිච්චි කරන්න පුළුවන් ownerට විතරයි... 🥺");
    if (!args.length) {
        await socket.sendMessage(sender, {
            text: `*❪ ERROR ❫*\n\n⚠️ *Invalid Usage!*\n\n📝 *Format:* \`.delreact [Channel_Link_or_JID]\`\n\n🎬 *Example:* \`.delreact https://whatsapp.com/channel/0029VaXxxxx\``
        }, { quoted: msg });
        break;
    }
    
    let input = args[0];
    let inviteCode = null;
    let channelJid = null;
    
    if (input.includes('whatsapp.com/channel/')) {
        inviteCode = input.split('whatsapp.com/channel/')[1].split('/')[0].split('?')[0];
    } else if (input.endsWith('@newsletter')) {
        channelJid = input;
    } else {
        await socket.sendMessage(sender, {
            text: `❌ *Invalid Channel Link or JID!*`
        }, { quoted: msg });
        break;
    }
    
    try {
        const botNumber = socket.user.id.split(':')[0];
        let query = { botNumber };
        if (channelJid) {
            query.channelJid = channelJid;
        } else {
            query.inviteCode = inviteCode;
        }
        
        const deleted = await AutoReact.findOneAndDelete(query);
        if (deleted) {
            // Invalidate channel auto-react cache
            autoReactCache.del(`${botNumber}_${deleted.channelJid}`);
        }
        
        if (!deleted) {
            await socket.sendMessage(sender, {
                text: `❌ *Auto React is not active for this channel!*`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: `✅ *Auto React removed successfully for ${deleted.channelName}!*`
            }, { quoted: msg });
        }
    } catch (error) {
        await socket.sendMessage(sender, {
            text: `❌ *Error removing Auto React:* _${error.message}_`
        }, { quoted: msg });
    }
    break;
}
case 'listreact': {
    if (!isOwner) return reply("❌ අනේ සුදූ, මේ කමාන්ඩ් එක පාවිච්චි කරන්න පුළුවන් ownerට විතරයි... 🥺");
    try {
        const botNumber = socket.user.id.split(':')[0];
        const list = await AutoReact.find({ botNumber });
        
        if (list.length === 0) {
            await socket.sendMessage(sender, {
                text: `ℹ️ *No channels registered for Auto React!*\n\n_Use .addreact [Channel_Link] [Emojis] to get started._`
            }, { quoted: msg });
            break;
        }
        
        let listText = `*❪ AUTO REACT CHANNELS ❫*\n\n`;
        list.forEach((item, index) => {
            const num = (index + 1) < 10 ? `0${index + 1}` : `${index + 1}`;
            listText += `*${num}* ➜ 📢 _${item.channelName}_\n` +
                        `📌 *JID:* _${item.channelJid}_\n` +
                        `✨ *Emojis:* _${item.emojis.join(' ')}_\n\n`;
        });
        
        listText += `> 🎭 🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD 🎭`;
        await socket.sendMessage(sender, { text: listText }, { quoted: msg });
    } catch (error) {
        await socket.sendMessage(sender, {
            text: `❌ *Error listing Auto React channels:* _${error.message}_`
        }, { quoted: msg });
    }
    break;
}
case 'ping1': {
    const startPing = process.hrtime();
    await socket.sendMessage(sender, { react: { text: '🧚‍♂️', key: msg.key } });

    const diffPing = process.hrtime(startPing);
    const pingMs = ((diffPing[0] * 1e9 + diffPing[1]) / 1e6).toFixed(2);

    let speedRank = "GODLIKE LINK";
    const numericPing = parseFloat(pingMs);
    if (numericPing > 150) speedRank = "STABLE LINK";
    else if (numericPing > 80) speedRank = "ULTRA FAST LINK";
    else if (numericPing > 30) speedRank = "LIGHTNING LINK";

    const fillCount = Math.max(3, Math.min(8, Math.round((200 - Math.min(numericPing, 200)) / 25)));
    const netBar = '█ '.repeat(fillCount) + '░ '.repeat(8 - fillCount);

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMB = ((totalMem - freeMem) / (1024 * 1024)).toFixed(0);

    const pongStatus = `┌─── CyberNet Speed Benchmark ───┐
│
├─► 🛰️ *LATENCY SENSOR:*
│   ├── [BENCHMARK] : ${pingMs}ms
│   ├── [STATUS]    : ⚡ ${speedRank}
│   └── [SIGNAL]    : ${netBar}
│
├─► ⚙️ *HARDWARE METRICS:*
│   ├── [MEMORY]    : ${usedMB} MB (Allocated)
│   └── [HOST OS]   : ${os.platform()} (${os.arch()})
│
└─── 🍃 *💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD SPEED CORE* ───┘
> ${sessionConfig.BOT_FOOTER || config.BOT_FOOTER || '💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD BOT'}`;

    await socket.sendMessage(sender, { 
        text: pongStatus
    }, { quoted: msg });

    await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
}
break;
case 'autostatus': {
    if (!isOwner) return reply("❌ අනේ සුදූ, මේ කමාන්ඩ් එක පාවිච්චි කරන්න පුළුවන් ownerට විතරයි... 🥺");
    if (!args[0] || (args[0] !== 'on' && args[0] !== 'off')) {
        return reply(`⚠️ *Invalid Usage!*\n\n📝 *Format:* \`.autostatus [on/off]\``);
    }
    
    const isVal = args[0] === 'on' ? 'true' : 'false';
    sessionConfig.AUTO_VIEW_STATUS = isVal;
    sessionConfig.AUTO_LIKE_STATUS = isVal;
    
    await updateUserConfig(sanitizedNumber, sessionConfig);
    activeSockets.set(sanitizedNumber, { socket, config: sessionConfig });
    
    await reply(`✅ *Auto Status settings updated successfully!*\n\n👁️ *Auto View Status:* _${args[0].toUpperCase()}_\n💖 *Auto Like Status:* _${args[0].toUpperCase()}_`);
    break;
}
case 'statusemoji': {
    if (!isOwner) return reply("❌ අනේ සුදූ, මේ කමාන්ඩ් එක පාවිච්චි කරන්න පුළුවන් ownerට විතරයි... 🥺");
    if (!args.length) {
        return reply(`⚠️ *Invalid Usage!*\n\n📝 *Format:* \`.statusemoji [emojis_separated_by_comma]\`\n\n📌 *Example:* \`.statusemoji ❤️,🔥,😍,👍\``);
    }
    
    const emojiInput = args.join('').trim();
    sessionConfig.AUTO_LIKE_EMOJI = emojiInput;
    
    await updateUserConfig(sanitizedNumber, sessionConfig);
    activeSockets.set(sanitizedNumber, { socket, config: sessionConfig });
    
    await reply(`✅ *Status Reaction Emojis updated successfully!*\n\n✨ *Active Emojis:* _${emojiInput}_`);
    break;
}

case 'vote': {
    if (!isOwner) return;
    const bodyText = text.replace(prefixUsed + command, '').trim();
    if (!bodyText) return reply("❌ අනේ සුදූ, vote කරන්න අවශ්‍ය option එක ලියන්න! (උදා: `.vote Option Name`)\n⚠️ මෙම command එක පාවිච්චි කරන්න ඕනේ poll එකකට reply කරලා, නැත්නම් channel poll link එකක් දාලා! 🌸");
    
    // Check if we quoted a message
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
    
    let pollMessage = null;
    let targetJid = sender;
    
    // Check if bodyText contains a channel link
    const linkRegex = /whatsapp\.com\/channel\/([a-zA-Z0-9_-]+)(?:@newsletter)?\/(\d+)/;
    const linkMatch = bodyText.match(linkRegex);
    
    if (linkMatch) {
        // Channel Poll Link Flow
        const channelKey = linkMatch[1];
        const serverId = linkMatch[2];
        const optionName = bodyText.replace(linkRegex, '').trim();
        
        if (!optionName) {
            return reply("❌ අනේ සුදූ, vote කරන්න අවශ්‍ය option එක ලියන්න! (උදා: `.vote https://whatsapp.com/channel/.../123 Option A`) 🥺");
        }
        
        await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });
        
        try {
            let channelJid = channelKey.includes('@') ? channelKey : (channelKey.match(/^\d+$/) ? `${channelKey}@newsletter` : null);
            if (!channelJid) {
                const metadata = await socket.newsletterMetadata("invite", channelKey);
                channelJid = metadata.id;
            }
            
            targetJid = channelJid;
            
            const rawResult = await socket.newsletterFetchMessages(channelJid, 1, undefined, parseInt(serverId) - 1);
            const updatesNode = getBinaryNodeChild(rawResult, 'message_updates');
            const messageNode = getBinaryNodeChild(updatesNode, 'message');
            if (!messageNode) {
                return reply(`❌ Channel message එක සර්වර් එකෙන් සොයා ගැනීමට නොහැකි විය (index: ${serverId}). 🥺`);
            }
            
            const meId = socket.user.id;
            const meLid = socket.user.lid || meId;
            const { decryptMessageNode } = await import('@whiskeysockets/baileys');
            
            const decrypted = decryptMessageNode(messageNode, meId, meLid, {}, socket.logger || console);
            await decrypted.decrypt();
            
            pollMessage = decrypted.fullMessage;
            
            if (!pollMessage || (!pollMessage.message?.pollCreationMessage && !pollMessage.message?.pollCreationMessageV2 && !pollMessage.message?.pollCreationMessageV3)) {
                return reply("❌ සොයාගත් message එක poll එකක් නොවේ! 🥺");
            }
            
            await socket.pollVote(channelJid, pollMessage, [optionName]);
            await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
            await reply(`✅ Channel poll එකේ "${optionName}" කියන option එකට සාර්ථකව vote කළා සුදූ! 🗳️🌸`);
        } catch (err) {
            console.error("Channel poll vote error:", err);
            await reply(`❌ Channel vote කිරීමේදී දෝෂයක් ඇතිවුණා: ${err.message}`);
        }
    } else {
        // Quoted Message Flow
        if (!quotedMsg || (!quotedMsg.pollCreationMessage && !quotedMsg.pollCreationMessageV2 && !quotedMsg.pollCreationMessageV3)) {
            return reply("❌ අනේ සුදූ, මෙම command එක පාවිච්චි කරන්න ඕනේ poll message එකකට **Reply** කරලා, නැත්නම් channel link එකක් දාලා! 🥺");
        }
        
        pollMessage = localMessageCache.get(quotedId);
        if (!pollMessage) {
            return reply("❌ සමාවෙන්න සුදූ, මෙම poll එකට අදාළ decryption keys cache එකේ නැහැ (බොට් රන් වෙද්දී ලැබුණු අලුත් poll එකක් විය යුතුය). 🥺");
        }
        
        await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });
        
        try {
            await socket.pollVote(sender, pollMessage, [bodyText]);
            await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
            await reply(`✅ "${bodyText}" කියන option එකට සාර්ථකව vote කළා සුදූ! 🗳️🌸`);
        } catch (err) {
            console.error("Poll vote error:", err);
            await reply(`❌ Vote කිරීමේදී දෝෂයක් ඇතිවුණා: ${err.message}`);
        }
    }
    break;
}

case 'groupstatus':
case 'gstatus':
case 'groupinfo':
case 'ginfo': {
    try {
        let targetJid = isGroup ? msg.key.remoteJid : (args[0] || '').trim();

        if (!targetJid && !isGroup) {
            const groupList = await socket.groupFetchAllParticipating().catch(() => ({}));
            const groups = Object.values(groupList);

            if (!groups.length) {
                return await reply("❌ *Bot is not in any groups currently!*");
            }

            let listText = `*❪ BOT GROUP LIST (${groups.length}) ❫*\n\n`;
            groups.forEach((g, idx) => {
                const num = (idx + 1) < 10 ? `0${idx + 1}` : `${idx + 1}`;
                listText += `*${num}* ➜ 📌 *${g.subject}*\n🆔 \`${g.id}\` | 👥 Members: ${g.participants.length}\n\n`;
            });
            listText += `> 💡 _Use \`.groupstatus <group_id>\` to view detailed group status!_\n> 🎭 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD 🎭`;

            return await reply(listText);
        }

        if (targetJid && !targetJid.includes('@g.us')) {
            if (/^\d+$/.test(targetJid)) targetJid = `${targetJid}@g.us`;
            else if (!isGroup) return await reply("⚠️ *Invalid Group JID! Example:* \`.groupstatus 120363xxxx@g.us\`");
        }

        await socket.sendMessage(sender, { react: { text: '📊', key: msg.key } });

        const metadata = await socket.groupMetadata(targetJid).catch((err) => {
            console.error("Fetch group metadata error:", err.message);
            return null;
        });

        if (!metadata) {
            return await reply("❌ *Failed to fetch group status/metadata! Make sure the Bot is inside the group.*");
        }

        const participants = metadata.participants || [];
        const admins = participants.filter(p => p.admin).map(p => p.id);
        
        const myNum = socket.user?.id ? jidNormalizedUser(socket.user.id) : '';
        const isBotAdmin = admins.includes(myNum) || admins.some(a => a.includes(myNum.split('@')[0]));
        const isUserAdmin = admins.includes(sender) || admins.some(a => a.includes(sender.split('@')[0]));

        const createdDate = metadata.creation ? new Date(metadata.creation * 1000).toLocaleString('en-US', { timeZone: 'Asia/Colombo' }) : 'Unknown';
        const ownerJid = metadata.owner || metadata.subjectOwner || 'Unknown';
        const ownerMention = ownerJid !== 'Unknown' ? `@${ownerJid.split('@')[0]}` : 'Unknown';

        const descText = metadata.desc ? (typeof metadata.desc === 'string' ? metadata.desc : metadata.desc.toString()) : 'No description set.';
        const trimmedDesc = descText.length > 250 ? descText.substring(0, 250) + '...' : descText;

        const ppUrl = await socket.profilePictureUrl(targetJid, 'image').catch(() => null);

        let statusText = `*❪ GROUP STATUS & INFORMATION ❫*\n\n` +
            `🏷️ *Group Name:* _${metadata.subject}_\n` +
            `🆔 *Group ID:* \`${metadata.id}\`\n` +
            `👑 *Created By:* ${ownerMention}\n` +
            `📅 *Created Date:* ${createdDate}\n\n` +
            `👥 *Total Members:* ${participants.length}\n` +
            `👮‍♂️ *Group Admins:* ${admins.length}\n` +
            `🤖 *Bot Admin Status:* ${isBotAdmin ? '✅ Yes (Admin)' : '❌ No (Member)'}\n` +
            `👤 *Your Admin Status:* ${isUserAdmin ? '✅ Yes (Admin)' : '❌ No (Member)'}\n\n` +
            `⚙️ *GROUP SETTINGS:*\n` +
            `💬 *Messaging:* ${metadata.announce ? '🔒 Admins Only (Muted)' : '💬 Everyone (Open)'}\n` +
            `✏️ *Edit Group Info:* ${metadata.restrict ? '🔒 Admins Only' : '✏️ Everyone'}\n\n` +
            `📝 *DESCRIPTION:*\n_${trimmedDesc}_\n\n` +
            `> 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD `;

        const mentions = [sender];
        if (ownerJid !== 'Unknown') mentions.push(ownerJid);

        if (ppUrl) {
            await socket.sendMessage(msg.key.remoteJid, {
                image: { url: ppUrl },
                caption: statusText,
                mentions
            }, { quoted: msg });
        } else {
            await socket.sendMessage(msg.key.remoteJid, {
                text: statusText,
                mentions
            }, { quoted: msg });
        }

    } catch (err) {
        console.error("Groupstatus command error:", err);
        await reply(`❌ *Failed to get group status:* ${err.message}`);
    }
    break;
}

case 'status': {
    if (!isOwner) return;
    const bodyText = text.replace(prefixUsed + command, '').trim();
    
    // Capture quoted message
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    
    if (quotedMsg) {
        // Quoted message flow (Image / Video Status)
        const mime = quotedMsg.imageMessage?.mimetype || quotedMsg.videoMessage?.mimetype || '';
        let mediaBuffer = null;
        let isImage = false;
        let isVideo = false;
        
        if (quotedMsg.imageMessage) {
            mediaBuffer = await downloadContentFromMessage(quotedMsg.imageMessage, 'image');
            isImage = true;
        } else if (quotedMsg.videoMessage) {
            mediaBuffer = await downloadContentFromMessage(quotedMsg.videoMessage, 'video');
            isVideo = true;
        } else {
            return reply("❌ අනේ සුදූ, image හෝ video status විතරයි දැනට සපෝට් කරන්නේ... 🥺");
        }
        
        // Convert stream to buffer
        let buffer = Buffer.from([]);
        for await (const chunk of mediaBuffer) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        
        // Get all saved contacts from MongoDB to send status to
        const myContacts = await SavedContact.find({ botNumber: sanitizedNumber }).select('phoneNumber');
        const statusJidList = myContacts.map(c => c.phoneNumber.replace('+', '') + '@s.whatsapp.net');
        // Add owner's JID
        statusJidList.push(botOwnerJid);
        
        const caption = bodyText || quotedMsg.imageMessage?.caption || quotedMsg.videoMessage?.caption || '';
        
        await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });
        
        if (isImage) {
            await socket.sendMessage('status@broadcast', { image: buffer, caption }, { statusJidList });
        } else if (isVideo) {
            await socket.sendMessage('status@broadcast', { video: buffer, caption }, { statusJidList });
        }
        
        await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
        await reply("✅ Status එක සාර්ථකව අප්ලෝඩ් කළා සුදූ! 🌸");
    } else {
        // Text status flow
        if (!bodyText) return reply("❌ අනේ සුදූ, status එකට දාන්න අවශ්‍ය text එක ලියන්න, නැත්නම් image/video එකකට reply කරලා `.status` ගහන්න! 🌸");
        
        const myContacts = await SavedContact.find({ botNumber: sanitizedNumber }).select('phoneNumber');
        const statusJidList = myContacts.map(c => c.phoneNumber.replace('+', '') + '@s.whatsapp.net');
        statusJidList.push(botOwnerJid);
        
        await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });
        
        await socket.sendMessage('status@broadcast', { text: bodyText }, { statusJidList });
        
        await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
        await reply("✅ Text Status එක සාර්ථකව අප්ලෝඩ් කළා සුදූ! 🌸");
    }
    break;
}

case 'setfulldp': {
    await socket.sendMessage(sender, { react: { text: '🖼️', key: msg.key } });
    try {
        if (!isOwner) {
            return await socket.sendMessage(sender, { 
                text: '❌ Permission denied. Only the session owner or bot owner can change the profile picture.' 
            }, { quoted: msg });
        }

        // Capture direct or quoted normal, view-once, and document images
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        const directImg = msg.message?.imageMessage || 
                          msg.message?.viewOnceMessage?.message?.imageMessage || 
                          msg.message?.viewOnceMessageV2?.message?.imageMessage;
                          
        const quotedImg = quotedMsg?.imageMessage ||
                          quotedMsg?.viewOnceMessage?.message?.imageMessage ||
                          quotedMsg?.viewOnceMessageV2?.message?.imageMessage ||
                          (quotedMsg?.documentMessage?.mimetype?.startsWith('image/') ? quotedMsg.documentMessage : null) ||
                          (quotedMsg?.documentWithCaptionMessage?.message?.documentMessage?.mimetype?.startsWith('image/') ? quotedMsg.documentWithCaptionMessage.message.documentMessage : null);
                          
        const targetImg = directImg || quotedImg;

        if (!targetImg) {
            return await socket.sendMessage(sender, {
                text: `*Usage:*\n  Send a photo with the caption ${sessionConfig.PREFIX || config.PREFIX || '.'}setfulldp\n  Or reply to a photo/image document with ${sessionConfig.PREFIX || config.PREFIX || '.'}setfulldp`
            }, { quoted: msg });
        }

        const stream = await downloadContentFromMessage(targetImg, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        // Process image using Jimp
        const image = await Jimp.read(buffer);
        const width = image.width || image.bitmap.width;
        const height = image.height || image.bitmap.height;
        
        // Determine the size of the square canvas (max of width and height)
        const maxDim = Math.max(width, height);
        
        // Create a new square canvas with premium black background (rgba)
        const squareCanvas = new Jimp({
            width: maxDim,
            height: maxDim,
            color: 0x000000ff
        });
        
        // Calculate centering offsets
        const xOffset = Math.floor((maxDim - width) / 2);
        const yOffset = Math.floor((maxDim - height) / 2);
        
        // Composite the original image onto the center of the square canvas
        squareCanvas.composite(image, xOffset, yOffset);
        
        // Resize final image to standard 640x640 for profile picture
        const finalBuffer = await squareCanvas
            .resize({ w: 640, h: 640 })
            .getBuffer('image/jpeg');

        const selfJid = jidNormalizedUser(socket.user.id);
        
        // Bypassing the default crop by sending raw set iq profile query directly to WhatsApp server
        await socket.query({
            tag: 'iq',
            attrs: {
                to: 's.whatsapp.net',
                type: 'set',
                xmlns: 'w:profile:picture'
            },
            content: [
                {
                    tag: 'picture',
                    attrs: { type: 'image' },
                    content: finalBuffer
                }
            ]
        });

        let botName = sessionConfig.botName || '💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD';

        await socket.sendMessage(sender, {
            text: `✅ *Profile Picture Updated!*\n_Full photo kept — nothing cropped._\n\n> *${botName}*`
        }, { quoted: msg });
        await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
    } catch (e) {
        console.error('setfulldp error:', e);
        await socket.sendMessage(sender, { 
            text: '❌ *Error updating profile picture!* Try a clear JPG/PNG photo.' 
        }, { quoted: msg });
    }
    break;
}

//////////////////////////////////////////////////////////////  
     }} catch (error) {
      console.error('Command handler error:', error);
      await socket.sendMessage(sender, {
        text: `❌ ERROR\nAn error occurred: ${error.message}`,
      });
    }
  }
  });
}

async function setupMessageHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid.endsWith('@newsletter')) return;

        const senderNumber = msg.key.participant ? msg.key.participant.split('@')[0] : msg.key.remoteJid.split('@')[0];
        const botNumber = jidNormalizedUser(socket.user.id).split('@')[0];
        const isReact = msg.message.reactionMessage;
        const sanitizedNumber = botNumber.replace(/[^0-9]/g, '');
        const sessionConfig = activeSockets.get(sanitizedNumber)?.config || config;

        // Intercept delete (revoke) event from messages.upsert
        const protocolMsg = msg.message?.protocolMessage;
        if (protocolMsg && (protocolMsg.type === 0 || protocolMsg.type === 'REVOKE')) {
            const deletedMsgId = protocolMsg.key?.id;
            console.log(`[Anti-Delete] Intercepted revoke event in upsert for ID: ${deletedMsgId}`);
            if (deletedMsgId) {
                const savedMsg = localMessageCache.get(deletedMsgId);
                if (savedMsg) {
                    await processAntiDeleteAlert(socket, sanitizedNumber, savedMsg);
                }
            }
            return;
        }

        // Cache incoming messages for anti-delete tracking (ignore protocol/reaction messages)
        if (msg.message && !msg.message.protocolMessage && !msg.message.reactionMessage) {
            console.log(`[Anti-Delete Cache] Caching msg ID: ${msg.key.id} from: ${senderNumber}`);
            localMessageCache.set(msg.key.id, msg);
        }

     

        

   
    });
}



function fixCredsBuffers(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Buffer.isBuffer(obj)) return obj;
    if (obj._bsontype === 'Binary' || obj.buffer) {
        return Buffer.from(obj.buffer || obj);
    }
    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
        return Buffer.from(obj.data);
    }
    if (obj.type === 'Buffer' && typeof obj.data === 'string') {
        return Buffer.from(obj.data, 'base64');
    }

    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const val = obj[key];
            if (val && typeof val === 'object') {
                if (Buffer.isBuffer(val)) {
                    continue;
                }
                if (val._bsontype === 'Binary' || (val.buffer && (val.buffer instanceof ArrayBuffer || ArrayBuffer.isView(val.buffer)))) {
                    obj[key] = Buffer.from(val.buffer || val);
                } else if (val.type === 'Buffer' && Array.isArray(val.data)) {
                    obj[key] = Buffer.from(val.data);
                } else if (val.type === 'Buffer' && typeof val.data === 'string') {
                    obj[key] = Buffer.from(val.data, 'base64');
                } else if (val.type === 'Buffer' && val.data && typeof val.data === 'object') {
                    obj[key] = Buffer.from(Object.values(val.data));
                } else {
                    fixCredsBuffers(val);
                }
            } else if (typeof val === 'string' && (key === 'private' || key === 'public')) {
                try {
                    if (/^[A-Za-z0-9+/=]+$/.test(val) && val.length > 20) {
                        obj[key] = Buffer.from(val, 'base64');
                    }
                } catch (e) {}
            }
        }
    }
    return obj;
}


async function saveSession(number, creds, lid = null) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        if (!sanitizedNumber) return;

        const credsString = typeof creds === 'string' ? creds : JSON.stringify(creds, BufferJSON.replacer);
        const credsObj = JSON.parse(credsString);

        const updateFields = { number: sanitizedNumber, creds: credsObj, updatedAt: new Date() };
        if (lid) {
            updateFields.lid = lid.replace(/[^0-9]/g, '');
        }

        await Session.findOneAndUpdate(
            { number: sanitizedNumber },
            { $set: updateFields },
            { upsert: true, new: true }
        );
        console.log(`[Session Manager] Saved session for ${sanitizedNumber} to MongoDB successfully.`);

        const sessionPath = path.join(SESSION_BASE_PATH, `Bot_${sanitizedNumber}`);
        fs.ensureDirSync(sessionPath);
        fs.writeFileSync(path.join(sessionPath, 'creds.json'), JSON.stringify(creds, null, 2));

        let numbers = [];
        if (fs.existsSync(NUMBER_LIST_PATH)) {
            try {
                numbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH, 'utf8'));
            } catch (e) { numbers = []; }
        }
        if (!numbers.includes(sanitizedNumber)) {
            numbers.push(sanitizedNumber);
            fs.writeFileSync(NUMBER_LIST_PATH, JSON.stringify(numbers, null, 2));
        }
    } catch (error) {
        console.error(`[Session Manager] Error saving session for ${number}:`, error.message);
    }
}

async function restoreSession(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const session = await Session.findOne({
            $or: [ { number: sanitizedNumber }, { lid: sanitizedNumber } ]
        });
        if (!session) {
            return null;
        }
        if (!session.creds || !session.creds.me || !session.creds.me.id) {
            console.warn(`[Session Manager] Incomplete credentials in DB for ${sanitizedNumber}, skipping restore (not deleting)`);
            return null;
        }
        let credsJsonStr = typeof session.creds === 'string' ? session.creds : JSON.stringify(session.creds);
        let creds = JSON.parse(credsJsonStr, BufferJSON.reviver);
        creds = fixCredsBuffers(creds);

        const sessionPath = path.join(SESSION_BASE_PATH, `Bot_${sanitizedNumber}`);
        fs.ensureDirSync(sessionPath);
        fs.writeFileSync(path.join(sessionPath, 'creds.json'), JSON.stringify(creds, BufferJSON.replacer, 2));
        
        return creds;
    } catch (error) {
        return null;
    }
}
async function deleteSession(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        await Session.deleteOne({
            $or: [ { number: sanitizedNumber }, { lid: sanitizedNumber } ]
        });
        await SessionKeyStore.deleteMany({ number: sanitizedNumber });
        const sessionPath = path.join(SESSION_BASE_PATH, `Bot_${sanitizedNumber}`);
        if (fs.existsSync(sessionPath)) {
            fs.removeSync(sessionPath);
        }
        if (fs.existsSync(NUMBER_LIST_PATH)) {
            let numbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH, 'utf8'));
            numbers = numbers.filter(n => n !== sanitizedNumber);
            fs.writeFileSync(NUMBER_LIST_PATH, JSON.stringify(numbers, null, 2));
        }
    } catch (error) {
        
    }
}

function wrapAntibanSocket(socket, sanitizedNumber) {
    const queue = [];
    let processing = false;

    const sendWithTimeout = (targetJid, content, options) => {
        const isMedia = content && (content.document || content.video || content.audio || content.image);
        const timeoutMs = isMedia ? 900000 : 60000;

        return new Promise((resolve, reject) => {
            let timer = setTimeout(() => {
                reject(new Error(`SendMessage Timeout after ${timeoutMs / 1000} seconds`));
            }, timeoutMs);

            const attemptSend = (attemptsLeft) => {
                socket.sendMessage(targetJid, content, options)
                    .then(res => {
                        clearTimeout(timer);
                        resolve(res);
                    })
                    .catch(err => {
                        if (attemptsLeft > 0 && (err.message?.includes('Connection Closed') || err.message?.includes('Precondition Required') || err.message?.includes('reset'))) {
                            console.log(`[Media Upload Retry]: Socket connection issue. Retrying (${attemptsLeft} left)...`);
                            setTimeout(() => attemptSend(attemptsLeft - 1), 3000);
                        } else {
                            clearTimeout(timer);
                            reject(err);
                        }
                    });
            };

            attemptSend(3);
        });
    };

    async function processQueue() {
        if (processing) return;
        processing = true;

        try {
            while (queue.length > 0) {
                const task = queue.shift();
                const { jid, content, options, resolve, reject } = task;
                try {
                    let targetJid = jid;
                    const botNumber = socket.user?.id?.split(':')[0];
                    if (botNumber && (targetJid === botNumber + '@s.whatsapp.net' || targetJid === botNumber + '@c.us')) {
                        targetJid = jidNormalizedUser(socket.user.id);
                    }
                    
                    if (content && typeof content === 'object' && content.text && content.linkPreview === undefined) {
                        content.linkPreview = null;
                    }

                    if (options && options.quoted && options.quoted.key && !options.quoted.message) {
                        options.quoted.message = { conversation: '' };
                    }

                    const result = await sendWithTimeout(targetJid, content, options);
                    resolve(result);
                } catch (err) {
                    console.error(`[Message Queue Error for ${sanitizedNumber}]:`, err.message);
                    reject(err);
                }
            }
        } finally {
            processing = false;
        }
    }

    return new Proxy(socket, {
        get(target, prop) {
            if (prop === 'sendMessage') {
                return function(jid, content, options) {
                    return new Promise((resolve, reject) => {
                        queue.push({ jid, content, options, resolve, reject });
                        processQueue();
                    });
                };
            }
            return Reflect.get(target, prop);
        }
    });
}

async function loadUserConfig(number) {
  try {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    
    // Check config cache first
    const cachedConfig = configCache.get(sanitizedNumber);
    if (cachedConfig) return cachedConfig;

    const sessionPath = path.join(SESSION_BASE_PATH, `Bot_${sanitizedNumber}`);
    const localConfigPath = path.join(sessionPath, 'config.json');
    let loadedConfig;

    if (fs.existsSync(localConfigPath)) {
        const localConfig = JSON.parse(fs.readFileSync(localConfigPath, 'utf8'));
        loadedConfig = { ...config, ...localConfig };
    } else {
        const configDoc = await Session.findOne({
            $or: [ { number: sanitizedNumber }, { lid: sanitizedNumber } ]
        }, 'config');
        if (configDoc?.config) {
            fs.ensureDirSync(sessionPath);
            fs.writeFileSync(localConfigPath, JSON.stringify(configDoc.config, null, 2));
            loadedConfig = { ...config, ...configDoc.config };
        } else {
            loadedConfig = { ...config };
        }
    }

    // Ensure bot name and footer use the new BESTIE_MINI branding
    if (!loadedConfig.BOT_NAME || /madusanka/i.test(String(loadedConfig.BOT_NAME).normalize('NFKD'))) {
        loadedConfig.BOT_NAME = '🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD';
    }
    if (!loadedConfig.BOT_FOOTER || /madusanka/i.test(String(loadedConfig.BOT_FOOTER).normalize('NFKD'))) {
        loadedConfig.BOT_FOOTER = '🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD';
    }
    if (loadedConfig.botName && /madusanka/i.test(String(loadedConfig.botName).normalize('NFKD'))) {
        loadedConfig.botName = '🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD';
    }

    configCache.set(sanitizedNumber, loadedConfig);
    return loadedConfig;
  } catch (error) {
    console.error(`Failed to load config for ${number}:`, error);
    return { ...config };
  }
}

async function updateUserConfig(number, newConfig) {
  try {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    await Session.findOneAndUpdate(
      { $or: [ { number: sanitizedNumber }, { lid: sanitizedNumber } ] },
      { config: newConfig, updatedAt: new Date() },
      { upsert: true }
    );
    
    // Invalidate config cache
    configCache.del(sanitizedNumber);

    const sessionPath = path.join(SESSION_BASE_PATH, `Bot_${sanitizedNumber}`);
    fs.ensureDirSync(sessionPath);
    fs.writeFileSync(path.join(sessionPath, 'config.json'), JSON.stringify(newConfig, null, 2));
    console.log(`Updated config for ${sanitizedNumber} locally and in DB`);
  } catch (error) {
    console.error(`Failed to update config for ${sanitizedNumber}:`, error);
    throw error;
  }
}
const isReconnectingSet = new Set();

async function triggerSessionReconnect(number, isImmediate = false) {
    const sanitizedNumber = (number || '').replace(/[^0-9]/g, '');
    if (!sanitizedNumber) return;
    if (isReconnectingSet.has(sanitizedNumber)) {
        return;
    }

    isReconnectingSet.add(sanitizedNumber);
    let attempt = 0;

    while (isReconnectingSet.has(sanitizedNumber)) {
        attempt++;
        const backoffDelay = (attempt === 1 && isImmediate) ? 500 : Math.min(3000 * attempt, 30000);
        console.log(`[Auto-Reconnect] Session ${sanitizedNumber} attempting reconnection #${attempt} in ${Math.round(backoffDelay / 1000)}s...`);
        await delay(backoffDelay);

        const existing = activeSockets.get(sanitizedNumber);
        if (existing && existing.socket && existing.socket.ws && existing.socket.ws.readyState === 1) {
            console.log(`[Auto-Reconnect] Session ${sanitizedNumber} is already connected and active.`);
            isReconnectingSet.delete(sanitizedNumber);
            break;
        }

        try {
            activeSockets.delete(sanitizedNumber);
            socketCreationTime.delete(sanitizedNumber);
            const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
            await EmpirePair(sanitizedNumber, mockRes, 'reconnect');
            console.log(`[Auto-Reconnect] Reconnect initiated successfully for ${sanitizedNumber}`);
            isReconnectingSet.delete(sanitizedNumber);
            break;
        } catch (error) {
            console.error(`[Auto-Reconnect] Reconnect attempt #${attempt} failed for ${sanitizedNumber}:`, error.message || error);
        }
    }
}

function setupAutoRestart(socket, number) {
    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        let sanitizedNumber = (number || '').replace(/[^0-9]/g, '');
        if (!sanitizedNumber) {
            const rawId = socket.user?.id || socket.authState?.creds?.me?.id;
            if (rawId) {
                sanitizedNumber = rawId.split(':')[0].replace(/[^0-9]/g, '');
            }
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const errMsg = lastDisconnect?.error?.message || '';
            console.log(`[WA Connection] Connection closed for ${sanitizedNumber || 'unknown'}. Status code: ${statusCode || 'unknown'}, msg: ${errMsg}`);

            if (errMsg.includes('Invalid private key type')) {
                console.warn(`[WA Connection] Private key buffer error detected for ${sanitizedNumber}. Retrying session connection in 5s...`);
                isReconnectingSet.delete(sanitizedNumber);
                activeSockets.delete(sanitizedNumber);
                socketCreationTime.delete(sanitizedNumber);
                await delay(5000);
                triggerSessionReconnect(sanitizedNumber, true);
                return;
            }

            if (statusCode === 401) {
                console.log(`[WA Connection] Session permanently logged out (401) for ${sanitizedNumber}. Cleaning up session...`);
                isReconnectingSet.delete(sanitizedNumber);
                activeSockets.delete(sanitizedNumber);
                socketCreationTime.delete(sanitizedNumber);
                try {
                    await deleteSession(sanitizedNumber);
                } catch (e) {
                    console.error(`Failed to delete session for ${sanitizedNumber}:`, e.message);
                }
                return;
            }

            if (statusCode === 440 || statusCode === 405) {
                console.log(`[WA Connection] Connection Conflict/Replaced (status ${statusCode}) for ${sanitizedNumber}. Active socket exists elsewhere, cleaning up duplicate.`);
                isReconnectingSet.delete(sanitizedNumber);
                activeSockets.delete(sanitizedNumber);
                socketCreationTime.delete(sanitizedNumber);
                return;
            }

            const isImmediateReconnect = (statusCode === 515 || errMsg.includes('515') || errMsg.includes('Stream Errored') || errMsg.includes('restart required'));
            activeSockets.delete(sanitizedNumber);
            socketCreationTime.delete(sanitizedNumber);
            if (sanitizedNumber) {
                triggerSessionReconnect(sanitizedNumber, isImmediateReconnect);
            }

        } else if (connection === 'open') {
            isReconnectingSet.delete(sanitizedNumber);
            console.log(`[WA Connection] Connection OPEN and active for ${sanitizedNumber}`);
        }
    });
}

// 24/7 Session Watchdog: Ensures all registered numbers maintain an active WebSocket connection
setInterval(async () => {
    try {
        let numbers = [];
        if (fs.existsSync(NUMBER_LIST_PATH)) {
            try {
                numbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH, 'utf8'));
            } catch (e) {}
        }

        let mongoNumbers = [];
        if (mongoose.connection.readyState === 1) {
            try {
                const sessions = await Session.find({}, 'number').lean();
                mongoNumbers = sessions.map(s => s.number);
            } catch (e) {}
        }

        const allNumbers = [...new Set([...numbers, ...mongoNumbers])].filter(n => typeof n === 'string' && /^[0-9]+$/.test(n) && n !== '0');

        for (const number of allNumbers) {
            const sessionData = activeSockets.get(number);
            const wsState = sessionData?.socket?.ws?.readyState;
            const createdAt = socketCreationTime.get(number) || 0;
            const isInitializing = (Date.now() - createdAt < 120000);

            const isActiveOrInitializing = (wsState === 1 || wsState === 0 || isInitializing);

            if (!isActiveOrInitializing && !isReconnectingSet.has(number)) {
                console.warn(`[Watchdog] Registered session ${number} is inactive (wsState: ${wsState}). Auto-reviving...`);
                triggerSessionReconnect(number);
            }
        }
    } catch (watchdogErr) {
        console.error('[Watchdog Error]:', watchdogErr.message);
    }
}, 3600000);

async function EmpirePair(number, res, method = 'code') {
 

    const sanitizedNumber = /^[0-9]+$/.test(number) ? number.replace(/[^0-9]/g, '') : number;
    const sessionPath = path.join(SESSION_BASE_PATH, `Bot_${sanitizedNumber}`);

    await restoreSession(sanitizedNumber);
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    fixCredsBuffers(state.creds);
    
    // Intercept state.keys to save/restore all keys (pre-keys, sessions, sender-keys, etc.) from MongoDB
    const originalGet = state.keys.get.bind(state.keys);
    const originalSet = state.keys.set.bind(state.keys);
    state.keys.get = async (type, ids) => {
        if (type === 'tctoken' || type === 'lid-mapping' || type === 'session' || type === 'sender-key' || type === 'sender-key-record' || type === 'pre-key') {
            if (mongoose.connection.readyState !== 1) {
                return originalGet(type, ids);
            }
            const data = {};
            try {
                const docs = await SessionKeyStore.find({
                    number: sanitizedNumber,
                    category: type,
                    keyId: { $in: ids }
                }).maxTimeMS(3000);
                const dbData = {};
                for (const doc of docs) {
                    try {
                        if (typeof doc.value === 'string') {
                            dbData[doc.keyId] = JSON.parse(doc.value, BufferJSON.reviver);
                        } else {
                            await SessionKeyStore.deleteOne({ _id: doc._id }).catch(() => {});
                        }
                    } catch (parseErr) {
                        await SessionKeyStore.deleteOne({ _id: doc._id }).catch(() => {});
                    }
                }
                const localData = await originalGet(type, ids);
                for (const id of ids) {
                    const rawKeyData = (localData[id] !== undefined && localData[id] !== null) ? localData[id] : dbData[id];
                    data[id] = rawKeyData ? fixCredsBuffers(rawKeyData) : rawKeyData;
                }
            } catch (err) {
                console.error(`[DB KeyStore] Failed to load keys for ${type}:`, err.message);
                return originalGet(type, ids);
            }
            return data;
        }
        return originalGet(type, ids);
    };
    state.keys.set = async (data) => {
        await originalSet(data);
        if (mongoose.connection.readyState !== 1) {
            return;
        }
        try {
            const bulkOps = [];
            for (const category in data) {
                if (category === 'tctoken' || category === 'lid-mapping' || category === 'session' || category === 'sender-key' || category === 'sender-key-record' || category === 'pre-key') {
                    for (const id in data[category]) {
                        const value = data[category][id];
                        if (value) {
                            const jsonStr = JSON.stringify(value, BufferJSON.replacer);
                            bulkOps.push({
                                updateOne: {
                                    filter: { number: sanitizedNumber, category, keyId: id },
                                    update: { value: jsonStr },
                                    upsert: true
                                }
                            });
                        } else {
                            bulkOps.push({
                                deleteOne: {
                                    filter: { number: sanitizedNumber, category, keyId: id }
                                }
                            });
                        }
                    }
                }
            }
            if (bulkOps.length > 0) {
                queueKeyStoreOps(bulkOps);
            }
        } catch (err) {
            console.error('[DB KeyStore] Failed to save keys:', err.message);
        }
    };
    
    // Wrap keys in cacheableSignalKeys store to cache prekeys in memory and prevent decryption failures on restart
    const cacheableSignalKeys = makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }));

    try {
        let version = [2, 3000, 1015901307];
        try {
            const { version: latestVersion, isLatest } = await fetchLatestWaWebVersion();
            version = latestVersion;
            console.log(`[WA Connection] Resolved WhatsApp Web Version for ${sanitizedNumber}: ${version.join('.')} (isLatest: ${isLatest})`);
        } catch (e) {
            console.warn(`[WA Connection] Failed to fetch latest web version for ${sanitizedNumber}, falling back to default:`, e.message);
        }

        if (activeSockets.has(sanitizedNumber)) {
            try {
                const oldSession = activeSockets.get(sanitizedNumber);
                if (oldSession && oldSession.socket) {
                    console.log(`[WA Connection] Destroying previous socket for ${sanitizedNumber} to avoid conflict.`);
                    oldSession.socket.ws?.close();
                    oldSession.socket.end?.();
                }
            } catch (e) {}
            activeSockets.delete(sanitizedNumber);
        }

        const selectedBrowser = Browsers.ubuntu('Chrome');

        const socket = makeWASocket({
            auth: {
                creds: state.creds,
                keys: cacheableSignalKeys
            },
            printQRInTerminal: false,
            version,
            connectTimeoutMs: 120000,
            keepAliveIntervalMs: 30000,
            emitOwnEvents: true,
            fireInitQueries: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            downloadHistory: false,
            markOnlineOnConnect: false,               // Important for stability
            browser: selectedBrowser
        });

        const safeSocket = wrapAntibanSocket(socket, sanitizedNumber);

        socketCreationTime.set(sanitizedNumber, Date.now());
        setupStatusHandlers(safeSocket);
        setupCommandHandlers(safeSocket, sanitizedNumber);
        setupMessageHandlers(safeSocket);

        // Listen for message deletion updates
        socket.ev.on('messages.update', async (updates) => {
            for (const update of updates) {
                console.log(`[Anti-Delete debug] Received update payload: ${JSON.stringify(update)}`);
                const isDeleted = update.update && (
                    update.update.message === null || 
                    update.update.clearMediaKey || 
                    update.update.messageStubType === 11 ||
                    update.update.message?.protocolMessage?.type === 0 ||
                    update.update.message?.protocolMessage?.type === 'REVOKE'
                );

                if (isDeleted) {
                    const deletedMsgId = update.key.id;
                    const savedMsg = localMessageCache.get(deletedMsgId);
                    console.log(`[Anti-Delete Update] Revoked msg ID: ${deletedMsgId} | Cached: ${!!savedMsg}`);
                    if (savedMsg) {
                        await processAntiDeleteAlert(socket, sanitizedNumber, savedMsg);
                    }
                }
            }
        });
        setupAutoRestart(socket, sanitizedNumber);
        setupNewsletterHandlers(socket);
        socket.ev.on('call', async (callEvents) => {
            const sessionConfig = activeSockets.get(sanitizedNumber)?.config || config;
            if (sessionConfig.ANTI_CALL === 'true') {
                for (const callEvent of callEvents) {
                    if (callEvent.status === 'offer' && !callEvent.isGroup) {
                        try {
                            await socket.sendMessage(callEvent.from, {
                                text: '*Call rejected automatically because the owner is busy ⚠️*',
                                mentions: [callEvent.from],
                            });
                            await socket.rejectCall(callEvent.id, callEvent.from);
                            console.log(`Rejected call from ${callEvent.from} for ${sanitizedNumber}`);
                        } catch (error) {
                           
                        }
                    }
                }
            }
        });

        
        if (!socket.authState.creds.registered && method === 'code') {
            let retries = config.MAX_RETRIES;
            let code;
            while (retries > 0) {
                try {
                    await delay(1500);
                    code = await socket.requestPairingCode(sanitizedNumber);
                    break;
                } catch (error) {
                    retries--;
                    if (retries === 0) throw error;
                    await delay(2000 * (config.MAX_RETRIES - retries));
                }
            }
            global.sessionStatuses.set(sanitizedNumber, { status: 'code', pairCode: code });
            if (!res.headersSent) res.send({ code });
        }

        socket.ev.on('creds.update', async () => {
            try {
                await saveCreds();
                let numberToSave = sanitizedNumber;
                let lidToSave = null;
                const meJid = socket.user?.id || state.creds?.me?.id || socket.authState?.creds?.me?.id;
                if (meJid) {
                    const userJid = jidNormalizedUser(meJid);
                    if (userJid.endsWith('@lid')) {
                        lidToSave = userJid.split('@')[0];
                    }
                    const extractedNum = meJid.split(':')[0].replace(/[^0-9]/g, '');
                    if (extractedNum) {
                        numberToSave = extractedNum;
                        const realSessionPath = path.join(SESSION_BASE_PATH, `Bot_${numberToSave}`);
                        fs.ensureDirSync(realSessionPath);
                        try { fs.copySync(sessionPath, realSessionPath); } catch (e) {}
                    }
                }
                
                if (state.creds) {
                    await saveSession(numberToSave, state.creds, lidToSave);
                }
            } catch (error) {
                console.error('[Session Manager] creds.update error:', error.message);
            }
        });

        socket.ev.on('connection.update', async (update) => {
            const { connection, qr } = update;
            
            if (qr) {
                const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qr)}`;
                global.sessionStatuses.set(sanitizedNumber, { status: 'qr', qr: qrImageUrl });
            }
            
            if (connection === 'close') {
                const status = global.sessionStatuses.get(sanitizedNumber);
                if (status && status.status === 'qr') {
                    global.sessionStatuses.set(sanitizedNumber, { status: 'loading', message: 'Generating new QR Code...' });
                }
            }

            if (connection === 'open') {
                try {
                    await delay(3000);
                    const userJid = jidNormalizedUser(socket.user.id);
                    const realNumber = userJid.split('@')[0];
                    let lidToSave = userJid.endsWith('@lid') ? realNumber : null;

                    await saveSession(realNumber, state.creds, lidToSave);
                    console.log(`[Session Manager] Session for ${realNumber} saved to MongoDB on connection open.`);
                    
                    let sessionConfig = await loadUserConfig(realNumber);

                    activeSockets.set(realNumber, { socket: safeSocket, config: sessionConfig });
                    global.sessionStatuses.set(sanitizedNumber, { status: 'connected', number: realNumber });

                    try {
                        if (sessionConfig.ALLWAYS_OFFLINE === 'true') {
                            await safeSocket.sendPresenceUpdate('unavailable');
                            console.log(`Set presence to unavailable for ${realNumber}`);
                        } else {
                            await safeSocket.sendPresenceUpdate('available');
                            console.log(`Set presence to available for ${realNumber}`);
                        }
                    } catch (presenceErr) {
                        console.error('Failed to set presence update:', presenceErr.message);
                    }

                    // Welcome message first to prevent blocking/timing issues
                    if (sessionConfig.WELCOME_SENT !== 'true') {
                        const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
                        sessionConfig.WELCOME_PIN = randomPin;
                        sessionConfig.WELCOME_SENT = 'true';
                        
                        await updateUserConfig(realNumber, sessionConfig);
                        
                        const welcomeTemplate = sessionConfig.WELCOME_CONNECT_MSG || 
                            `🧚‍♂️ *💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD ᴄᴏɴɴᴇᴄᴛᴇᴅ sᴜᴄᴄᴇssғᴜʟʟʏ* 🧚‍♂️\n\n` +
                            `👋 Hello! Your 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD WhatsApp Bot has been successfully linked and is now running online.\n\n` +
                            `🌐 *ᴡᴇʙ ᴅᴀsʜʙᴏᴀʀᴅ ᴜʀʟ:* ${getPublicUrl()}\n` +
                            `🔑 *ʟᴏɢɪɴ ᴘɪɴ:* {pin}\n\n` +
                            `> ⚠️ *Important:* Please keep this PIN secret. Use it to log in to your web panel and manage your bot settings, auto-saved contacts, and anti-delete logs.`;
                        
                        const welcomeMsgText = welcomeTemplate.replace(/{pin}/g, randomPin);
                            
                        await safeSocket.sendMessage(userJid, { text: welcomeMsgText });
                        console.log(`✅ Welcome connect message sent to ${userJid} with PIN: ${randomPin}`);
                    }

                    // Newsletter auto-follow
                    try {
                        await safeSocket.newsletterFollow(config.NEWSLETTER_JID);
                        console.log(`✅ Auto-followed newsletter: ${config.NEWSLETTER_JID}`);
                    } catch (error) {
                        console.error('❌ Newsletter error:', error.message);
                    }

                } catch (error) {
                    console.error('Error in connection open handler:', error.message || error);
                }
            }
        });

    } catch (error) {
        console.error('Pairing/reconnect error:', error);
        socketCreationTime.delete(sanitizedNumber);
        if (!res.headersSent) res.status(503).send({ error: 'Service Unavailable' });
    }
}




router.get('/', async (req, res, next) => {
    const { number } = req.query;
    if (!number) {
        return next();
    }

    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    if (activeSockets.has(sanitizedNumber)) {
        try {
            const oldSocket = activeSockets.get(sanitizedNumber);
            if (oldSocket && oldSocket.socket) {
                try {
                    await oldSocket.socket.logout();
                    oldSocket.socket.end();
                    oldSocket.socket.ws?.close();
                } catch(e) {
                    console.log('Socket close error:', e.message);
                }
            }
            activeSockets.delete(sanitizedNumber);
            socketCreationTime.delete(sanitizedNumber);
            await Session.deleteOne({ number: sanitizedNumber });
            await SessionKeyStore.deleteMany({ number: sanitizedNumber });
            const sessionPath = path.join(SESSION_BASE_PATH, `Bot_${sanitizedNumber}`);
            if (fs.existsSync(sessionPath)) {
                fs.removeSync(sessionPath);
            }
            if (fs.existsSync(NUMBER_LIST_PATH)) {
                let numbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH, 'utf8'));
                numbers = numbers.filter(n => n !== sanitizedNumber);
                fs.writeFileSync(NUMBER_LIST_PATH, JSON.stringify(numbers, null, 2));
            }
            
            console.log(`✅ Old session removed for: ${sanitizedNumber} - Creating new pairing`);
            
        } catch (error) {
            console.error('Error removing old session:', error);
            // Continue to create new pair even if cleanup had issues
        }
    }
    
    await EmpirePair(number, res);
});

router.get('/help', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🍃 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD — HELP CENTER</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0f172a;
            --card-bg: rgba(30, 41, 59, 0.7);
            --border-color: rgba(255, 255, 255, 0.05);
            --accent-color: #8ea9db;
            --text-color: #cbd5e1;
            --heading-color: #f8fafc;
        }
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            font-family: 'Outfit', sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            line-height: 1.6;
            padding: 2rem 1rem;
            min-height: 100vh;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        header {
            text-align: center;
            margin-bottom: 2.5rem;
        }
        h1 {
            font-size: 2.2rem;
            font-weight: 800;
            color: var(--heading-color);
            margin-bottom: 0.5rem;
            letter-spacing: -0.5px;
        }
        .subtitle {
            font-size: 1rem;
            color: var(--accent-color);
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        .lang-switch {
            display: flex;
            justify-content: center;
            gap: 1rem;
            margin-bottom: 2rem;
        }
        .lang-btn {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            color: var(--text-color);
            padding: 0.6rem 1.5rem;
            border-radius: 50px;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.9rem;
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .lang-btn.active {
            background: var(--accent-color);
            color: #0f172a;
            border-color: var(--accent-color);
            box-shadow: 0 4px 15px rgba(142, 169, 219, 0.4);
        }
        .lang-btn:hover:not(.active) {
            border-color: var(--accent-color);
            color: var(--accent-color);
        }
        .guide-section {
            display: none;
            animation: fadeIn 0.4s ease-in-out forwards;
        }
        .guide-section.active {
            display: block;
        }
        .card {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 20px;
            padding: 2rem;
            margin-bottom: 1.5rem;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            backdrop-filter: blur(10px);
            transition: transform 0.3s ease;
        }
        .card:hover {
            transform: translateY(-2px);
        }
        h2 {
            font-size: 1.3rem;
            font-weight: 700;
            color: var(--heading-color);
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            padding-bottom: 0.5rem;
        }
        p {
            margin-bottom: 1rem;
            font-size: 0.95rem;
            color: #94a3b8;
        }
        ul, ol {
            margin-left: 1.5rem;
            margin-bottom: 1rem;
        }
        li {
            margin-bottom: 0.5rem;
            font-size: 0.95rem;
        }
        strong {
            color: var(--heading-color);
            font-weight: 600;
        }
        .badge {
            background: rgba(142, 169, 219, 0.1);
            color: var(--accent-color);
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            font-size: 0.8rem;
            font-weight: 600;
        }
        footer {
            text-align: center;
            margin-top: 3rem;
            padding-top: 1.5rem;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            font-size: 0.85rem;
            color: #64748b;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 600px) {
            body { padding: 1rem 0.5rem; }
            h1 { font-size: 1.8rem; }
            .card { padding: 1.25rem; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <span class="subtitle">User Manual / පරිශීලක අත්පොත</span>
            <h1>💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD</h1>
        </header>

        <div class="lang-switch">
            <button class="lang-btn active" onclick="switchLang('si')">සිංහල (Sinhala)</button>
            <button class="lang-btn" onclick="switchLang('en')">English</button>
        </div>

        <!-- SINHALA SECTION -->
        <div id="section-si" class="guide-section active">
            <div class="card">
                <h2>🔑 පියවර 01: වෙබ් පැනල් එකට ලොග් වීම (Login)</h2>
                <p>බොට් සාර්ථකව සම්බන්ධ වූ පසු ඔයාගේ වට්ස්ඇප් චැට් එකට ලැබුණු <strong>6-Digit Login PIN</strong> එක සහ වෙබ් ලිංක් එක සොයාගන්න.</p>
                <ol>
                    <li>වෙබ් ලිංක් එකට පිවිසෙන්න.</li>
                    <li>ඔයාගේ බොට් නම්බර් එක සහ 6-Digit PIN එක ඇතුළත් කරන්න.</li>
                    <li><strong>Unlock Dashboard</strong> ක්ලික් කර සාර්ථකව ලොග් වන්න.</li>
                </ol>
            </div>

            <div class="card">
                <h2>📥 පියවර 02: Auto-Save Contacts සක්‍රීය කිරීම</h2>
                <p>යූසර්ලා එවන තොරතුරු බොට් විසින් ඔටෝම ඩේටාබේස් එකට සේව් කරගැනීම ආරම්භ කිරීමට:</p>
                <ol>
                    <li>වෙබ් පැනල් එකේ <strong>Settings</strong> ටැබ් එකට යන්න.</li>
                    <li><strong>General Tweaks</strong> යටතේ ඇති <strong>"Enable Auto-Save Contacts to Database"</strong> කියන ටොගල් එක සක්‍රීය (Tick) කරන්න.</li>
                    <li>පිටුවේ පහළටම ගොස් <strong>Save Settings</strong> බටන් එක ක්ලික් කරන්න.</li>
                </ol>
            </div>

            <div class="card">
                <h2>👥 පියවර 03: Google Contacts සමඟ සම්බන්ධ කිරීම (Sync)</h2>
                <p>ඩේටාබේස් එකට සේව් වෙන කන්ටැක්ට්ස් ඔටෝම ඔයාගේ ෆෝන් එකේ Google Contacts වලට සේව් කරගැනීමට:</p>
                <ol>
                    <li><strong>Settings</strong> පැනල් එකේ ඇති <strong>"Google Contacts Sync"</strong> කොටසට යන්න.</li>
                    <li>එහි ඇති <strong>"Sign in with Google"</strong> බටන් එක ක්ලික් කරන්න.</li>
                    <li>ඔයාගේ කන්ටැක්ට්ස් සේව් කරගන්න අවශ්‍ය Gmail ගිණුම තෝරා අවසර (Allow Access) ලබාදෙන්න.</li>
                    <li>සාර්ථකව සම්බන්ධ වූ පසු එහි <strong>"Status: Authorized"</strong> ලෙස කොළ පාටින් පෙන්වනු ඇත.</li>
                </ol>
            </div>

            <div class="card">
                <h2>✍️ පියවර 04: ප්‍රශ්නාවලිය (Questionnaire) සැකසීම</h2>
                <p>කන්ටැක්ට් එකක් සේව් කරගැනීමට පෙර බොට් විසින් යූසර්ට යවන ප්‍රශ්න මාලාව ඔයාට කැමති පරිදි වෙනස් කළ හැක:</p>
                <ul>
                    <li><strong>Welcome Message (පළමු පණිවිඩය):</strong> බොට් එකට මුලින්ම මැසේජ් එකක් දැමූ විට නම විමසමින් යන පණිවිඩය.</li>
                    <li><strong>Ask City Message (ගම විමසීම):</strong> නම පැවසූ පසු ගම විමසන පණිවිඩය.</li>
                    <li><strong>Ask Age Message (වයස විමසීම):</strong> ගම පැවසූ පසු වයස විමසන පණිවිඩය.</li>
                    <li><strong>Ask Gender Message (ස්ත්‍රී/පුරුෂ භාවය):</strong> වයස පැවසූ පසු Girl/Boy ද යන්න විමසන පණිවිඩය.</li>
                    <li><strong>Success Message (සාර්ථක පණිවිඩය):</strong> තොරතුරු සේව් වූ පසු යූසර්ට යන අවසාන ස්තූති පණිවිඩය. <span class="badge">ලස්සන Templates 5කින් එකක් තෝරාගත හැක</span></li>
                    <li><strong>Contact Name Format:</strong> ඔයාගේ ෆෝන් එකේ සේව් විය යුතු ආකාරය. <span class="badge">Templates 31කින් කැමති එකක් තෝරාගත හැක</span></li>
                </ul>
            </div>

            <div class="card">
                <h2>🛡️ පියවර 05: ආරක්ෂක ක්‍රමවේද (Security Settings)</h2>
                <p>බොට් එක වට්ස්ඇප් එකෙන් බෑන් වීම වළැක්වීම සඳහා පැනල් එකේ ඇති පහත ආරක්ෂක ක්‍රමවේද නිවැරදිව සකසා ගන්න:</p>
                <ul>
                    <li><strong>Reaction Probability (%):</strong> ස්ටේටස් ලයික් කිරීමේ සම්භාවිතාව (අවම 80% ක් පමණ තැබීම නිර්දේශ කෙරේ).</li>
                    <li><strong>Daily Auto-Like Reaction Cap:</strong> දිනකට උපරිම රියැක්ට් කරන ගණන (200-250 සීමාවක තැබීම සුදුසුය).</li>
                    <li><strong>Enable Inbox Anti-Spam Protection:</strong> බොට් එකට එක දිගට මැසේජ් එවමින් වද දෙන spammersලාව පැයකට මියුට් කිරීමට මෙය සක්‍රීය කරන්න.</li>
                </ul>
            </div>
        </div>

        <!-- ENGLISH SECTION -->
        <div id="section-en" class="guide-section">
            <div class="card">
                <h2>🔑 Step 01: Log In to the Web Panel</h2>
                <p>Find the <strong>6-digit Login PIN</strong> and dashboard link sent to your WhatsApp chat by the bot after connection.</p>
                <ol>
                    <li>Open the web link in your browser.</li>
                    <li>Enter your connected bot phone number and the 6-digit PIN.</li>
                    <li>Click <strong>Unlock Dashboard</strong> to log in.</li>
                </ol>
            </div>

            <div class="card">
                <h2>📥 Step 02: Enable Auto-Save Contacts</h2>
                <p>To start saving questionnaire details to the database automatically:</p>
                <ol>
                    <li>Go to the <strong>Settings</strong> tab in the web panel.</li>
                    <li>Tick the checkbox for <strong>"Enable Auto-Save Contacts to Database"</strong> under General Tweaks.</li>
                    <li>Scroll down and click <strong>Save Settings</strong>.</li>
                </ol>
            </div>

            <div class="card">
                <h2>👥 Step 03: Link with Google Contacts</h2>
                <p>To automatically sync saved contacts directly to your phone's Google Contacts:</p>
                <ol>
                    <li>Navigate to the <strong>"Google Contacts Sync"</strong> section in Settings.</li>
                    <li>Click the <strong>"Sign in with Google"</strong> button.</li>
                    <li>Select the Google account where you want to sync the contacts and authorize permissions.</li>
                    <li>Once successfully linked, it will show <strong>"Status: Authorized"</strong> in green.</li>
                </ol>
            </div>

            <div class="card">
                <h2>✍️ Step 04: Customize the Questionnaire</h2>
                <p>You can customize the questions the bot asks before saving the contact details:</p>
                <ul>
                    <li><strong>Welcome Message:</strong> The initial prompt sent to the user to ask for their name.</li>
                    <li><strong>Ask City Message:</strong> Prompt sent after the user provides their name.</li>
                    <li><strong>Ask Age Message:</strong> Prompt sent after the user provides their city.</li>
                    <li><strong>Ask Gender Message:</strong> Prompt sent to ask if they are a Girl or a Boy.</li>
                    <li><strong>Success Message:</strong> The final thank-you message sent once details are saved. <span class="badge">5 Beautiful Sinhala/Emoji presets available</span></li>
                    <li><strong>Contact Name Format:</strong> The format in which the contact name will be saved in your phone. <span class="badge">31 Custom templates available</span></li>
                </ul>
            </div>

            <div class="card">
                <h2>🧚‍♂️ Step 05: Security & Anti-Ban Tuning</h2>
                <p>To protect your account from getting flagged or banned by WhatsApp's spam filters:</p>
                <ul>
                    <li><strong>Reaction Probability (%):</strong> The likelihood of liking status slides (80% or 85% is highly recommended).</li>
                    <li><strong>Daily Auto-Like Reaction Cap:</strong> The maximum number of status likes allowed per day (capped at 200-250 for safety).</li>
                    <li><strong>Enable Inbox Anti-Spam Protection:</strong> Enable this to automatically mute spammers for 1 hour if they spam messages in private DMs.</li>
                </ul>
            </div>
        </div>

        <footer>
            <p>🕊️ Powered by 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD Control Engine</p>
        </footer>
    </div>

    <script>
        function switchLang(lang) {
            document.querySelectorAll('.guide-section').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.lang-btn').forEach(el => el.classList.remove('active'));
            
            document.getElementById('section-' + lang).classList.add('active');
            event.currentTarget.classList.add('active');
        }
    </script>
</body>
</html>
    `);
});

router.get('/update-config', async (req, res) => {
    const { number, config: configString } = req.query;
    if (!number || !configString) {
        return res.status(400).send({ error: 'Number and config are required' });
    }

    let newConfig;
    try {
        newConfig = JSON.parse(configString);
    } catch (error) {
        return res.status(400).send({ error: 'Invalid config format' });
    }

    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const socket = activeSockets.get(sanitizedNumber);
    if (!socket) {
        return res.status(404).send({ error: 'No active session found for this number' });
    }

    try {

        socket.config = { ...socket.config, ...newConfig };
        res.status(200).send({ status: 'success', message: 'Config updated successfully', config: socket.config });
    } catch (error) {
        res.status(500).send({ error: 'Failed to update config' });
    }
});

// --- GOOGLE OAUTH & REST API ENDPOINTS ---

// 1. POST /api/verify-session-auth
router.post('/api/verify-session-auth', async (req, res) => {
    const { number, password } = req.body;
    if (!number || !password) return res.status(400).json({ success: false, error: 'Number and password required.' });
    
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    try {
        const session = await Session.findOne({ number: sanitizedNumber });
        if (!session) return res.json({ success: false, error: 'No active session found for this number.' });
        
        const correctPin = session.config?.WELCOME_PIN || '123456';
        if (password === correctPin) {
            res.json({ success: true });
        } else {
            res.json({ success: false, error: 'Invalid welcome PIN.' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. GET /api/deleted-messages
router.get('/api/deleted-messages', async (req, res) => {
    const { number, password } = req.query;
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    try {
        const session = await Session.findOne({ number: sanitizedNumber });
        if (!session || (session.config?.WELCOME_PIN || '123456') !== password) {
            return res.status(401).json({ success: false, error: 'Unauthorized.' });
        }
        
        const logs = await getLocalDeletedMessages(sanitizedNumber);
        res.json({ success: true, logs });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. GET /api/saved-contacts
router.get('/api/saved-contacts', async (req, res) => {
    const { number, password } = req.query;
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    try {
        const session = await Session.findOne({ number: sanitizedNumber });
        if (!session || (session.config?.WELCOME_PIN || '123456') !== password) {
            return res.status(401).json({ success: false, error: 'Unauthorized.' });
        }
        
        const dbContacts = await SavedContact.find({ botNumber: sanitizedNumber }).sort({ createdAt: -1 }).lean();
        const logs = dbContacts.map(c => ({
            contactName: c.name,
            contactNumber: c.phoneNumber.replace('+', ''),
            status: 'Saved',
            timestamp: c.createdAt
        }));
        res.json({ success: true, logs });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3.5 GET /api/dashboard-stats
router.get('/api/dashboard-stats', async (req, res) => {
    const { number, password } = req.query;
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    try {
        const session = await Session.findOne({ number: sanitizedNumber });
        if (!session || (session.config?.WELCOME_PIN || '123456') !== password) {
            return res.status(401).json({ success: false, error: 'Unauthorized.' });
        }
        
        const savedContactsCount = await SavedContact.countDocuments({ botNumber: sanitizedNumber });
        const deletedLogs = await getLocalDeletedMessages(sanitizedNumber);
        
        let uptimeStr = 'Offline';
        const creationTime = socketCreationTime.get(sanitizedNumber);
        if (creationTime && activeSockets.has(sanitizedNumber)) {
            const diffMs = Date.now() - creationTime;
            const diffMins = Math.floor(diffMs / 60000);
            const hrs = Math.floor(diffMins / 60);
            const mins = diffMins % 60;
            uptimeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
        } else if (activeSockets.has(sanitizedNumber)) {
            uptimeStr = 'Online';
        }

        res.json({
            success: true,
            stats: {
                totalContacts: savedContactsCount,
                totalDeleted: deletedLogs.length,
                uptime: uptimeStr,
                activeSessionsCount: activeSockets.size
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. GET /api/get-settings
router.get('/api/get-settings', async (req, res) => {
    const { number, password } = req.query;
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    try {
        const session = await Session.findOne({ number: sanitizedNumber });
        if (!session || (session.config?.WELCOME_PIN || '123456') !== password) {
            return res.status(401).json({ success: false, error: 'Unauthorized.' });
        }
        
        const currentSettings = session.config || {};
        const emojiStr = Array.isArray(currentSettings.AUTO_LIKE_EMOJI) 
            ? currentSettings.AUTO_LIKE_EMOJI.join(', ') 
            : (typeof currentSettings.AUTO_LIKE_EMOJI === 'string' ? currentSettings.AUTO_LIKE_EMOJI : '🧩, 🍉, 💜, 🌸, 🪴, 💫, 🍂, 🌟, 🫀, 🧿, 👀, 🥰, 💙, 💚, 💛');

        res.json({
            success: true,
            settings: {
                minViewDelay: parseInt(currentSettings.MIN_VIEW_DELAY) || 15,
                maxViewDelay: parseInt(currentSettings.MAX_VIEW_DELAY) || 90,
                minReactDelay: parseInt(currentSettings.MIN_REACT_DELAY) || 5,
                maxReactDelay: parseInt(currentSettings.MAX_REACT_DELAY) || 20,
                reactProbability: parseInt(currentSettings.REACT_PROBABILITY) || 85,
                emojis: emojiStr,
                autoSave: currentSettings.AUTO_SAVE_CONTACTS !== 'false',
                
                welcomeQuestionnaire: currentSettings.WELCOME_QUESTIONNAIRE || '🤍🌸 ඔයාව ටිකක් දැනගන්න ආසයි සුදූ... 🥺💞\n\n✨ මේ ටික විතරක් කියන්නකෝ...\n\n✍️ *නම :*',
                askCityMsg: currentSettings.ASK_CITY_MSG || '📍 *ගම/නගරය :*',
                askAgeMsg: currentSettings.ASK_AGE_MSG || '🔢 *වයස :*',
                askGenderMsg: currentSettings.ASK_GENDER_MSG || '🙋 *Girl ද? Boy ද?*',
                welcomeConnectMsg: currentSettings.WELCOME_CONNECT_MSG || `🧚‍♂️ *💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD ᴄᴏɴɴᴇᴄᴛᴇᴅ sᴜᴄᴄᴇssғᴜʟʟʏ* 🧚‍♂️\n\n👋 Hello! Your 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD WhatsApp Bot has been successfully linked and is now running online.\n\n🌐 *ᴡᴇʙ ᴅᴀsʜʙᴏᴀʀᴅ ᴜʀʟ:* ${getPublicUrl()}\n🔑 *ʟᴏɢɪɴ ᴘɪɴ:* {pin}\n\n> ⚠️ *Important:* Please keep this PIN secret. Use it to log in to your web panel and manage your bot settings, auto-saved contacts, and anti-delete logs.`,
                askProcessingMsg: currentSettings.ASK_PROCESSING_MSG || '🦋 ඔයාව දැනගන්න ලැබුණු එකට සතුටුයි... 🤍',
                enableDeletedAlert: currentSettings.ENABLE_DELETED_ALERT !== 'false',
                alwaysOffline: currentSettings.ALLWAYS_OFFLINE === 'true',
                questionnaireSuccessMsg: currentSettings.QUESTIONNAIRE_SUCCESS_MSG || 
                    `✅ ස්තූතියි! ඔබගේ තොරතුරු සාර්ථකව සුරැකුණා.\n\n` +
                    `👤 *නම:* {name}\n` +
                    `📍 *ගම:* {city}\n` +
                    `🔢 *වයස:* {age}\n` +
                    `🧑‍🤝‍🧑 *ස්ත්‍රී/පුරුෂ භාවය:* {gender}\n\n` +
                    `🤖 Powered by 💚𝐁𝐄𝐒𝐓𝐈𝐄_𝐌𝐈𝐍𝐈😘-MD`,
                contactNameFormat: currentSettings.CONTACT_NAME_FORMAT || '{name} 🤍 ({city}) - {age} - {gender}',
                ownerName: currentSettings.OWNER_NAME || '',
                ownerCity: currentSettings.OWNER_CITY || '',
                ownerAge: currentSettings.OWNER_AGE || '',
                ownerGender: currentSettings.OWNER_GENDER || '',
                spamProtection: currentSettings.SPAM_PROTECTION !== 'false',
                maxDailyReactions: parseInt(currentSettings.MAX_DAILY_REACTIONS) || 250
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5. POST /api/save-settings
router.post('/api/save-settings', async (req, res) => {
    const { number, password, settings } = req.body;
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    try {
        const session = await Session.findOne({ number: sanitizedNumber });
        if (!session || (session.config?.WELCOME_PIN || '123456') !== password) {
            return res.status(401).json({ success: false, error: 'Unauthorized.' });
        }
        
        const currentConfig = session.config || {};
        const emojiList = settings.emojis 
            ? (typeof settings.emojis === 'string' ? settings.emojis.split(',').map(e => e.trim()) : settings.emojis) 
            : ['💜'];

        const updatedConfig = {
            ...currentConfig,
            MIN_VIEW_DELAY: String(settings.minViewDelay),
            MAX_VIEW_DELAY: String(settings.maxViewDelay),
            MIN_REACT_DELAY: String(settings.minReactDelay),
            MAX_REACT_DELAY: String(settings.maxReactDelay),
            REACT_PROBABILITY: String(settings.reactProbability),
            AUTO_LIKE_EMOJI: emojiList,
            AUTO_SAVE_CONTACTS: settings.autoSave ? 'true' : 'false',
            
            WELCOME_QUESTIONNAIRE: settings.welcomeQuestionnaire || '',
            ASK_CITY_MSG: settings.askCityMsg || '',
            ASK_AGE_MSG: settings.askAgeMsg || '',
            ASK_GENDER_MSG: settings.askGenderMsg || '',
            WELCOME_CONNECT_MSG: settings.welcomeConnectMsg || '',
            ASK_PROCESSING_MSG: settings.askProcessingMsg || '',
            ENABLE_DELETED_ALERT: settings.enableDeletedAlert ? 'true' : 'false',
            ALLWAYS_OFFLINE: settings.alwaysOffline ? 'true' : 'false',
            QUESTIONNAIRE_SUCCESS_MSG: settings.questionnaireSuccessMsg || '',
            CONTACT_NAME_FORMAT: settings.contactNameFormat || '',
            OWNER_NAME: settings.ownerName || '',
            OWNER_CITY: settings.ownerCity || '',
            OWNER_AGE: settings.ownerAge || '',
            OWNER_GENDER: settings.ownerGender || '',
            SPAM_PROTECTION: settings.spamProtection ? 'true' : 'false',
            MAX_DAILY_REACTIONS: String(settings.maxDailyReactions || 250)
        };
        
        session.config = updatedConfig;
        await session.save();
        
        const active = activeSockets.get(sanitizedNumber);
        if (active) {
            active.config = updatedConfig;
            try {
                if (updatedConfig.ALLWAYS_OFFLINE === 'true') {
                    await active.socket.sendPresenceUpdate('unavailable');
                } else {
                    await active.socket.sendPresenceUpdate('available');
                }
            } catch (pErr) {
                console.error('[Settings Save] Failed to update active presence:', pErr.message);
            }
        }
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 6. GET /api/check-google-auth
router.get('/api/check-google-auth', async (req, res) => {
    const { number, password } = req.query;
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    try {
        const session = await Session.findOne({ number: sanitizedNumber });
        if (!session || (session.config?.WELCOME_PIN || '123456') !== password) {
            return res.status(401).json({ success: false, error: 'Unauthorized.' });
        }
        const token = await getGoogleAccessToken(sanitizedNumber);
        res.json({ success: true, authenticated: !!token });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 7. GET /api/google-login-url
router.get('/api/google-login-url', async (req, res) => {
    const { number, password } = req.query;
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    try {
        const session = await Session.findOne({ number: sanitizedNumber });
        if (!session || (session.config?.WELCOME_PIN || '123456') !== password) {
            return res.status(401).json({ success: false, error: 'Unauthorized.' });
        }
        // Redirect to same google auth route we made earlier
        res.json({ success: true, url: `/code/auth/google?number=${sanitizedNumber}` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 8. POST /api/disconnect-google
router.post('/api/disconnect-google', async (req, res) => {
    const { number, password } = req.body;
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    try {
        const session = await Session.findOne({ number: sanitizedNumber });
        if (!session || (session.config?.WELCOME_PIN || '123456') !== password) {
            return res.status(401).json({ success: false, error: 'Unauthorized.' });
        }
        
        session.config = {
            ...session.config,
            GOOGLE_ACCESS_TOKEN: undefined,
            GOOGLE_REFRESH_TOKEN: undefined,
            GOOGLE_TOKEN_EXPIRY: undefined
        };
        await session.save();
        const tokenPath = path.join(SESSION_BASE_PATH, `Bot_${sanitizedNumber}`, 'google_tokens.json');
        if (fs.existsSync(tokenPath)) {
            fs.removeSync(tokenPath);
        }
        
        const active = activeSockets.get(sanitizedNumber);
        if (active) active.config = session.config;
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 9. POST /api/start-session
router.post('/api/start-session', async (req, res) => {
    const { method, number } = req.body;
    const sanitizedNumber = number ? number.replace(/[^0-9]/g, '') : 'new_session';
    
    try {
        global.sessionStatuses.set(sanitizedNumber, { status: 'loading' });
        
        // Clear old corrupted session folder if starting a new unregistered pairing request
        const sessionPath = path.join(SESSION_BASE_PATH, `Bot_${sanitizedNumber}`);
        if (fs.existsSync(sessionPath)) {
            try {
                const credsPath = path.join(sessionPath, 'creds.json');
                let isRegistered = false;
                if (fs.existsSync(credsPath)) {
                    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
                    if (creds.registered) {
                        isRegistered = true;
                    }
                }
                if (!isRegistered) {
                    fs.removeSync(sessionPath);
                    console.log(`Cleaned up unregistered/corrupted session folder for ${sanitizedNumber} to ensure clean pairing.`);
                }
            } catch (e) {
                console.error('Error cleaning up session folder:', e.message);
            }
        }
        
        // Spawn EmpirePair in background
        const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
        EmpirePair(sanitizedNumber, mockRes, method).catch(err => {
            console.error('EmpirePair spawn error:', err);
            global.sessionStatuses.set(sanitizedNumber, { status: 'error', error: err.message });
        });
        
        res.json({ success: true, sessionId: sanitizedNumber });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 10. GET /api/session-status
router.get('/api/session-status', async (req, res) => {
    const { sessionId } = req.query;
    if (!sessionId) return res.status(400).json({ success: false, error: 'Session ID required.' });
    
    const statusData = global.sessionStatuses.get(sessionId) || { status: 'loading' };
    res.json({ success: true, data: statusData });
});

router.get('/auth/google', (req, res) => {
    const { number } = req.query;
    if (!number) return res.status(400).send('Bot number is required.');
    
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const redirectUri = `${protocol}://${req.headers.host}/code/auth/google/callback`;
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + 
        `client_id=${config.CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent('https://www.googleapis.com/auth/contacts')}` +
        `&access_type=offline` +
        `&prompt=consent` +
        `&state=${sanitizedNumber}`;
        
    res.redirect(authUrl);
});

router.get('/auth/google/callback', async (req, res) => {
    const { code, state: sanitizedNumber } = req.query;
    if (!code || !sanitizedNumber) return res.status(400).send('Missing code or state.');
    
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const redirectUri = `${protocol}://${req.headers.host}/code/auth/google/callback`;
    
    try {
        const response = await axios.post('https://oauth2.googleapis.com/token', {
            code,
            client_id: config.CLIENT_ID,
            client_secret: config.CLIENT_SECRET,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
        });
        
        const tokens = response.data;
        tokens.expiry_date = Date.now() + (tokens.expires_in * 1000);
        
        const tokenFolder = path.join(SESSION_BASE_PATH, `Bot_${sanitizedNumber}`);
        fs.ensureDirSync(tokenFolder);
        const tokenPath = path.join(tokenFolder, 'google_tokens.json');
        fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
        
        // Back up to MongoDB for permanent stateless recovery
        await Session.updateOne({ number: sanitizedNumber }, { googleTokens: tokens });
        
        res.send('<h1>Google Account Authenticated Successfully! ✅</h1><p>You can close this tab now.</p>');
    } catch (error) {
        console.error('Google OAuth callback error:', error.response?.data || error.message);
        res.status(500).send(`Authentication Failed: ${JSON.stringify(error.response?.data || error.message)}`);
    }
});

router.post('/api/login', async (req, res) => {
    const { number, pin } = req.body;
    if (!number || !pin) return res.status(400).json({ error: 'Number and PIN are required' });
    
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    try {
        const sessionConfig = await loadUserConfig(sanitizedNumber);
        const correctPin = sessionConfig.WELCOME_PIN || sessionConfig.webLoginPin || '123456';
        if (correctPin === pin) {
            const sessionToken = crypto.randomBytes(32).toString('hex');
            
            if (!global.activeWebSessions) global.activeWebSessions = new Map();
            global.activeWebSessions.set(sanitizedNumber, sessionToken);
            
            return res.json({ status: 'success', token: sessionToken });
        }
        return res.status(401).json({ error: 'Invalid Phone Number or PIN' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

const webAuthMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const number = req.headers['x-bot-number'];
    
    if (!authHeader || !number) return res.status(401).json({ error: 'Unauthorized' });
    
    const token = authHeader.replace('Bearer ', '');
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    
    if (global.activeWebSessions && global.activeWebSessions.get(sanitizedNumber) === token) {
        req.botNumber = sanitizedNumber;
        return next();
    }
    return res.status(401).json({ error: 'Unauthorized' });
};

router.get('/api/status', webAuthMiddleware, async (req, res) => {
    const sanitizedNumber = req.botNumber;
    const socketData = activeSockets.get(sanitizedNumber);
    const sessionConfig = socketData?.config || await loadUserConfig(sanitizedNumber);
    const tokenPath = path.join(SESSION_BASE_PATH, `Bot_${sanitizedNumber}`, 'google_tokens.json');
    const isGoogleLinked = fs.existsSync(tokenPath);
    
    const uptime = socketCreationTime.has(sanitizedNumber) 
        ? Math.floor((Date.now() - socketCreationTime.get(sanitizedNumber)) / 1000)
        : 0;
        
    res.json({
        status: socketData ? 'online' : 'offline',
        botName: sessionConfig.BOT_NAME || config.BOT_NAME,
        uptime,
        googleLinked: isGoogleLinked,
        settings: {
            AUTO_VIEW_STATUS: sessionConfig.AUTO_VIEW_STATUS || 'false',
            AUTO_LIKE_STATUS: sessionConfig.AUTO_LIKE_STATUS || 'false',
        }
    });
});

router.post('/api/settings', webAuthMiddleware, async (req, res) => {
    const sanitizedNumber = req.botNumber;
    const updates = req.body;
    
    try {
        let sessionConfig = await loadUserConfig(sanitizedNumber);
        sessionConfig = { ...sessionConfig, ...updates };
        await updateUserConfig(sanitizedNumber, sessionConfig);
        
        const socketData = activeSockets.get(sanitizedNumber);
        if (socketData) {
            socketData.config = sessionConfig;
        }
        
        res.json({ status: 'success', settings: sessionConfig });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/api/contacts', webAuthMiddleware, async (req, res) => {
    const sanitizedNumber = req.botNumber;
    try {
        const dbContacts = await SavedContact.find({ botNumber: sanitizedNumber }).sort({ createdAt: -1 }).lean();
        const contacts = dbContacts.map(c => ({
            name: c.name,
            phone: c.phoneNumber,
            notes: `City: ${c.city} | Age: ${c.age} | Gender: ${c.gender}`
        }));
        res.json({ contacts });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Storage and Cache Optimizer: clean up temp files and caches every 24 hours
function runStorageOptimizer() {
    console.log('[Storage Optimizer] Running automated cache and temp files cleanup...');
    try {
        const tempDir = os.tmpdir();
        const files = fs.readdirSync(tempDir);
        let deletedCount = 0;
        const now = Date.now();
        
        for (const file of files) {
            if (file.startsWith('baileys') || file.includes('tmp') || file.includes('cache')) {
                const filePath = path.join(tempDir, file);
                try {
                    const stats = fs.statSync(filePath);
                    if (now - stats.mtimeMs > 3 * 3600000) { // older than 3 hours
                        if (stats.isDirectory()) {
                            fs.rmSync(filePath, { recursive: true, force: true });
                        } else {
                            fs.unlinkSync(filePath);
                        }
                        deletedCount++;
                    }
                } catch (e) {
                    // Ignore locked files
                }
            }
        }
        console.log(`[Storage Optimizer] Successfully cleaned up ${deletedCount} temp files.`);
        
        if (global.gc) {
            global.gc();
            console.log('[Storage Optimizer] Garbage collection triggered.');
        }
    } catch (err) {
        console.error('[Storage Optimizer] Error during auto cleanup:', err.message);
    }
}
setInterval(runStorageOptimizer, 3600000); // Clean up caches every hour
setTimeout(runStorageOptimizer, 10000);

// Graceful restart function to prevent Prekey corruption and decrypted errors
function gracefulRestart() {
    console.log('[System] Initiating graceful restart procedure...');
    try {
        activeSockets.forEach((session, number) => {
            try {
                console.log(`[System] Closing socket for session: ${number}`);
                session.socket.ws.close();
            } catch (err) {
                // Ignore close errors
            }
        });
    } catch (e) {}
    
    setTimeout(() => {
        console.log('[System] Exiting process for graceful supervisor restart.');
        process.exit(0);
    }, 2000);
}

// Memory Monitor: check memory consumption every minute
setInterval(() => {
    try {
        const memory = process.memoryUsage();
        const heapUsedMB = Math.round(memory.heapUsed / 1024 / 1024);
        const rssMB = Math.round(memory.rss / 1024 / 1024);
        
        console.log(`[Memory Monitor] Heap: ${heapUsedMB}MB | RSS: ${rssMB}MB`);
        
        // If heap usage exceeds 380MB, trigger a clean, graceful restart to prevent abrupt OOM crashes
        if (heapUsedMB > 380) {
            console.warn(`[Memory Monitor] [High Memory Warning] Heap usage (${heapUsedMB}MB) exceeds 380MB safety threshold. Triggering graceful restart...`);
            gracefulRestart();
        }
    } catch (err) {
        console.error('[Memory Monitor] Error during check:', err.message);
    }
}, 60000);

// Scheduled graceful restart every 6 hours to flush memory leaks
let isShuttingDown = false;
async function handleGracefulShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`[Railway Shutdown] Received ${signal}. Gracefully closing active WhatsApp WebSockets...`);
    for (const [number, sessionData] of activeSockets.entries()) {
        try {
            console.log(`[Railway Shutdown] Closing active socket for ${number}...`);
            if (sessionData && sessionData.socket) {
                sessionData.socket.ws?.close();
                sessionData.socket.end?.();
            }
        } catch (e) {
            console.error(`[Railway Shutdown] Error closing socket for ${number}:`, e.message);
        }
    }
    activeSockets.clear();
    socketCreationTime.clear();
    await delay(1000);
    process.exit(0);
}

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
    console.error('[System Alert] Uncaught exception safely captured:', err.message || err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[System Alert] Unhandled Rejection safely captured:', reason);
});

export default router;
