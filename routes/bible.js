const express = require('express');
const axios = require('axios');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../config/database');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Base URL for Bible Gateway API
const BIBLE_GATEWAY_API_BASE = 'https://api.biblegateway.com/2';

// Bible Gateway API credentials (from environment variables)
const BIBLE_GATEWAY_USERNAME = process.env.BIBLE_GATEWAY_USERNAME;
const BIBLE_GATEWAY_PASSWORD = process.env.BIBLE_GATEWAY_PASSWORD;

// Legacy Bible API (for popular verses and reflections endpoints)
const BIBLE_API_BASE = 'https://bible.helloao.org/api';

// Initialize Gemini AI
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Cache for access token
let cachedAccessToken = null;
let tokenExpiration = null;

/**
 * Get Bible Gateway API access token
 * Caches the token until expiration
 */
async function getBibleGatewayToken() {
  console.log('🔐 getBibleGatewayToken() called', {
    hasCachedToken: !!cachedAccessToken,
    tokenExpiration: tokenExpiration ? new Date(tokenExpiration * 1000).toISOString() : 'none',
    currentTime: new Date().toISOString(),
    isTokenValid: cachedAccessToken && tokenExpiration && Date.now() < tokenExpiration * 1000,
    timestamp: new Date().toISOString()
  });

  // Return cached token if still valid
  if (cachedAccessToken && tokenExpiration && Date.now() < tokenExpiration * 1000) {
    console.log('✅ Using cached Bible Gateway token', {
      expiresIn: Math.floor((tokenExpiration * 1000 - Date.now()) / 1000) + ' seconds',
      timestamp: new Date().toISOString()
    });
    return cachedAccessToken;
  }

  try {
    console.log('🔑 Requesting new Bible Gateway access token...', {
      apiUrl: `${BIBLE_GATEWAY_API_BASE}/request_access_token`,
      hasUsername: !!BIBLE_GATEWAY_USERNAME,
      hasPassword: !!BIBLE_GATEWAY_PASSWORD,
      timestamp: new Date().toISOString()
    });

    const response = await axios.get(`${BIBLE_GATEWAY_API_BASE}/request_access_token`, {
      params: {
        username: BIBLE_GATEWAY_USERNAME,
        password: BIBLE_GATEWAY_PASSWORD
      }
    });

    console.log('📥 Bible Gateway API response received', {
      status: response.status,
      hasAccessToken: !!response.data.access_token,
      hasExpiration: !!response.data.expiration,
      timestamp: new Date().toISOString()
    });

    cachedAccessToken = response.data.access_token;
    tokenExpiration = response.data.expiration;

    console.log('✅ Bible Gateway token obtained successfully', {
      tokenLength: cachedAccessToken?.length || 0,
      expiresAt: new Date(tokenExpiration * 1000).toISOString(),
      expiresIn: Math.floor((tokenExpiration * 1000 - Date.now()) / 1000) + ' seconds',
      timestamp: new Date().toISOString()
    });

    return cachedAccessToken;
  } catch (error) {
    console.error('❌ Failed to get Bible Gateway token:', {
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      timestamp: new Date().toISOString()
    });
    throw new Error('Failed to authenticate with Bible Gateway API');
  }
}

// Get Available Bible Versions/Translations
router.get('/versions', authenticateToken, async (req, res) => {
  console.log('📖 Get Bible Versions Request:', {
    userId: req.user.id,
    userEmail: req.user.email,
    endpoint: '/api/bible/versions',
    method: 'GET',
    timestamp: new Date().toISOString()
  });

  try {
    console.log('🔑 Fetching Bible Gateway access token...');
    const accessToken = await getBibleGatewayToken();
    
    console.log('🌐 Making request to Bible Gateway API...', {
      url: `${BIBLE_GATEWAY_API_BASE}/bible`,
      hasToken: !!accessToken,
      tokenLength: accessToken?.length || 0,
      timestamp: new Date().toISOString()
    });

    const response = await axios.get(`${BIBLE_GATEWAY_API_BASE}/bible`, {
      params: { access_token: accessToken }
    });
    
    console.log('📥 Bible Gateway API response received:', {
      status: response.status,
      statusText: response.statusText,
      dataType: typeof response.data,
      hasBibles: !!response.data.bibles,
      timestamp: new Date().toISOString()
    });

    // Bible Gateway returns an array of Bible abbreviations
    const bibles = response.data.bibles || [];
    
    console.log('✅ Bible versions retrieved successfully:', {
      versionCount: bibles.length,
      firstFive: bibles.slice(0, 5),
      lastFive: bibles.slice(-5),
      timestamp: new Date().toISOString()
    });

    console.log('📤 Sending response to client:', {
      success: true,
      totalBibles: bibles.length,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        bibles: bibles,
        total: bibles.length
      }
    });

  } catch (error) {
    console.error('❌ Get Bible versions error:', {
      error: error.message,
      stack: error.stack,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve Bible versions',
      message: error.message
    });
  }
});

// Get Translation Info (includes available books)
router.get('/translation/:bible', authenticateToken, async (req, res) => {
  console.log('📚 Get Translation Info Request:', {
    userId: req.user.id,
    userEmail: req.user.email,
    bible: req.params.bible,
    endpoint: '/api/bible/translation/:bible',
    method: 'GET',
    timestamp: new Date().toISOString()
  });

  try {
    const { bible } = req.params;

    console.log('✅ Parameters validated:', {
      bible: bible,
      hasBible: !!bible,
      timestamp: new Date().toISOString()
    });

    if (!bible) {
      console.log('❌ Bible parameter missing');
      return res.status(400).json({
        success: false,
        error: 'Bible parameter is required'
      });
    }

    console.log('🔑 Fetching Bible Gateway access token...');
    const accessToken = await getBibleGatewayToken();
    
    console.log('🌐 Making request to Bible Gateway API...', {
      url: `${BIBLE_GATEWAY_API_BASE}/bible/${bible}`,
      bible: bible,
      hasToken: !!accessToken,
      timestamp: new Date().toISOString()
    });

    const response = await axios.get(`${BIBLE_GATEWAY_API_BASE}/bible/${bible}`, {
      params: { access_token: accessToken }
    });
    
    console.log('📥 Bible Gateway API response received:', {
      status: response.status,
      statusText: response.statusText,
      dataType: typeof response.data,
      responseKeys: Object.keys(response.data || {}),
      timestamp: new Date().toISOString()
    });

    console.log('✅ Translation info retrieved successfully:', {
      bible: bible,
      dataSize: JSON.stringify(response.data).length,
      timestamp: new Date().toISOString()
    });

    console.log('📤 Sending response to client');

    res.json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error('❌ Get translation info error:', {
      bible: req.params.bible,
      error: error.message,
      stack: error.stack,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      timestamp: new Date().toISOString()
    });
    
    if (error.response && error.response.status === 404) {
      console.log('📛 Translation not found:', req.params.bible);
      return res.status(404).json({
        success: false,
        error: 'Translation not found',
        message: `Translation '${req.params.bible}' is not available`
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve translation info',
      message: error.message
    });
  }
});

// Get Bible Passage (verse, verse range, or chapter)
// Examples: 
// - GET /api/bible/passage/niv/John 3:16
// - GET /api/bible/passage/niv/John 3:16-18
// - GET /api/bible/passage/niv/John 3
router.get('/passage/:bible/:passage(*)', authenticateToken, async (req, res) => {
  console.log('📖 Get Bible Passage Request:', {
    userId: req.user.id,
    userEmail: req.user.email,
    bible: req.params.bible,
    passage: req.params.passage,
    endpoint: '/api/bible/passage/:bible/:passage',
    method: 'GET',
    timestamp: new Date().toISOString()
  });

  try {
    const { bible, passage } = req.params;

    console.log('🔍 Validating parameters:', {
      bible: bible,
      passage: passage,
      hasBible: !!bible,
      hasPassage: !!passage,
      passageLength: passage?.length || 0,
      timestamp: new Date().toISOString()
    });

    // Validate parameters
    if (!bible || !passage) {
      console.log('❌ Missing required parameters');
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: bible and passage are required',
        examples: [
          'GET /api/bible/passage/niv/John 3:16',
          'GET /api/bible/passage/niv/John 3:16-18',
          'GET /api/bible/passage/niv/John 3'
        ]
      });
    }

    console.log('🔑 Fetching Bible Gateway access token...');
    const accessToken = await getBibleGatewayToken();
    
    console.log('🌐 Making request to Bible Gateway API...', {
      url: `${BIBLE_GATEWAY_API_BASE}/bible/osis/${passage}/${bible}`,
      bible: bible,
      passage: passage,
      hasToken: !!accessToken,
      timestamp: new Date().toISOString()
    });

    const response = await axios.get(`${BIBLE_GATEWAY_API_BASE}/bible/osis/${passage}/${bible}`, {
      params: { access_token: accessToken }
    });
    
    console.log('📥 Bible Gateway API response received:', {
      status: response.status,
      statusText: response.statusText,
      dataType: typeof response.data,
      dataLength: typeof response.data === 'string' ? response.data.length : JSON.stringify(response.data).length,
      timestamp: new Date().toISOString()
    });

    console.log('✅ Bible passage retrieved successfully:', {
      bible: bible,
      passage: passage,
      contentPreview: typeof response.data === 'string' ? response.data.substring(0, 100) + '...' : 'object',
      timestamp: new Date().toISOString()
    });

    console.log('📤 Sending response to client');

    res.json({
      success: true,
      data: {
        bible: bible,
        passage: passage,
        content: response.data
      }
    });

  } catch (error) {
    console.error('❌ Get Bible passage error:', {
      bible: req.params.bible,
      passage: req.params.passage,
      error: error.message,
      stack: error.stack,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      timestamp: new Date().toISOString()
    });
    
    if (error.response && error.response.status === 404) {
      console.log('📛 Passage not found:', {
        bible: req.params.bible,
        passage: req.params.passage
      });
      return res.status(404).json({
        success: false,
        error: 'Passage not found',
        message: `Passage '${req.params.passage}' not found in ${req.params.bible}`
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve Bible passage',
      message: error.message
    });
  }
});

// Search Bible
// Examples:
// - GET /api/bible/search/niv/love?search_type=all&limit=20
// - GET /api/bible/search/niv/faith hope love?search_type=phrase
router.get('/search/:bible/:query', authenticateToken, async (req, res) => {
  console.log('🔍 Bible Search Request:', {
    userId: req.user.id,
    userEmail: req.user.email,
    bible: req.params.bible,
    query: req.params.query,
    searchType: req.query.search_type,
    start: req.query.start,
    limit: req.query.limit,
    endpoint: '/api/bible/search/:bible/:query',
    method: 'GET',
    timestamp: new Date().toISOString()
  });

  try {
    const { bible, query } = req.params;
    const { search_type = 'all', start = 0, limit = 100 } = req.query;

    console.log('🔍 Search parameters:', {
      bible: bible,
      query: query,
      search_type: search_type,
      start: start,
      limit: limit,
      timestamp: new Date().toISOString()
    });

    // Validate parameters
    if (!bible || !query) {
      console.log('❌ Missing required parameters');
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: bible and query are required',
        examples: [
          'GET /api/bible/search/niv/love',
          'GET /api/bible/search/niv/faith hope love?search_type=phrase'
        ]
      });
    }

    console.log('🔑 Fetching Bible Gateway access token...');
    const accessToken = await getBibleGatewayToken();
    
    console.log('🌐 Making search request to Bible Gateway API...', {
      url: `${BIBLE_GATEWAY_API_BASE}/bible/search/${query}/${bible}`,
      bible: bible,
      query: query,
      search_type: search_type,
      hasToken: !!accessToken,
      timestamp: new Date().toISOString()
    });

    const response = await axios.get(`${BIBLE_GATEWAY_API_BASE}/bible/search/${query}/${bible}`, {
      params: {
        access_token: accessToken,
        search_type: search_type,
        start: start,
        limit: limit
      }
    });
    
    console.log('📥 Bible Gateway search API response received:', {
      status: response.status,
      statusText: response.statusText,
      dataType: typeof response.data,
      hasResults: !!response.data.results,
      resultsCount: response.data.results?.length || 0,
      total: response.data.total || 0,
      timestamp: new Date().toISOString()
    });

    console.log('✅ Bible search completed successfully:', {
      bible: bible,
      query: query,
      searchType: search_type,
      resultsReturned: response.data.results?.length || 0,
      totalResults: response.data.total || 0,
      timestamp: new Date().toISOString()
    });

    console.log('📤 Sending search results to client');

    res.json({
      success: true,
      data: {
        bible: bible,
        query: query,
        searchType: search_type,
        results: response.data.results || [],
        total: response.data.total || 0,
        start: parseInt(start),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('❌ Bible search error:', {
      bible: req.params.bible,
      query: req.params.query,
      error: error.message,
      stack: error.stack,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      error: 'Failed to search Bible',
      message: error.message
    });
  }
});

// Get Popular Bible Verses (Predefined list)
router.get('/popular-verses', authenticateToken, async (req, res) => {
  console.log('📖 Get Popular Bible Verses Request:', {
    userId: req.user.id,
    timestamp: new Date().toISOString()
  });

  try {
    const { version = 'en-kjv' } = req.query;

    // Popular Bible verses
    const popularVerses = [
      { book: 'john', chapter: 3, verse: 16, description: 'For God so loved the world' },
      { book: 'psalms', chapter: 23, verse: 1, description: 'The Lord is my shepherd' },
      { book: 'jeremiah', chapter: 29, verse: 11, description: 'Plans to prosper you' },
      { book: 'romans', chapter: 8, verse: 28, description: 'All things work together for good' },
      { book: 'philippians', chapter: 4, verse: 13, description: 'I can do all things' },
      { book: 'proverbs', chapter: 3, verse: 5, description: 'Trust in the Lord' },
      { book: 'matthew', chapter: 28, verse: 20, description: 'I am with you always' },
      { book: 'isaiah', chapter: 40, verse: 31, description: 'They that wait upon the Lord' },
      { book: 'corinthians1', chapter: 13, verse: 4, description: 'Love is patient' },
      { book: 'psalms', chapter: 46, verse: 1, description: 'God is our refuge' }
    ];

    const verses = [];

    for (const verseRef of popularVerses) {
      try {
        const url = `${BIBLE_API_BASE}/${version}/books/${verseRef.book}/chapters/${verseRef.chapter}/verses/${verseRef.verse}.json`;
        const response = await axios.get(url);
        
        verses.push({
          book: verseRef.book,
          chapter: verseRef.chapter,
          verse: verseRef.verse,
          text: response.data.text,
          reference: `${verseRef.book} ${verseRef.chapter}:${verseRef.verse}`,
          description: verseRef.description
        });
      } catch (error) {
        console.warn(`Failed to fetch ${verseRef.book} ${verseRef.chapter}:${verseRef.verse}:`, error.message);
      }
    }

    console.log('✅ Popular Bible verses retrieved successfully:', {
      version: version,
      verseCount: verses.length,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        version: version,
        verses: verses,
        total: verses.length
      }
    });

  } catch (error) {
    console.error('❌ Get popular Bible verses error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve popular Bible verses',
      message: error.message
    });
  }
});

// Search Bible Verses (Basic text search)
router.get('/search', authenticateToken, async (req, res) => {
  console.log('🔍 Search Bible Verses Request:', {
    userId: req.user.id,
    query: req.query,
    timestamp: new Date().toISOString()
  });

  try {
    const { 
      q: searchQuery, 
      version = 'en-kjv', 
      book, 
      limit = 10 
    } = req.query;

    if (!searchQuery) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    // For now, return a message that search is not fully implemented
    // In a real implementation, you would need to index the Bible text
    res.json({
      success: true,
      message: 'Bible search functionality is not yet fully implemented. Please use specific verse or chapter endpoints.',
      data: {
        searchQuery: searchQuery,
        version: version,
        book: book,
        limit: parseInt(limit),
        suggestion: 'Try using /bible/verse/:version/:book/:chapter/:verse or /bible/chapter/:version/:book/:chapter endpoints'
      }
    });

  } catch (error) {
    console.error('❌ Search Bible verses error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search Bible verses',
      message: error.message
    });
  }
});

// Get Bible Book List
router.get('/books', authenticateToken, async (req, res) => {
  console.log('📚 Get Bible Books Request:', {
    userId: req.user.id,
    timestamp: new Date().toISOString()
  });

  try {
    // Common Bible books list
    const books = [
      // Old Testament
      { name: 'Genesis', id: 'genesis', testament: 'old', order: 1 },
      { name: 'Exodus', id: 'exodus', testament: 'old', order: 2 },
      { name: 'Leviticus', id: 'leviticus', testament: 'old', order: 3 },
      { name: 'Numbers', id: 'numbers', testament: 'old', order: 4 },
      { name: 'Deuteronomy', id: 'deuteronomy', testament: 'old', order: 5 },
      { name: 'Joshua', id: 'joshua', testament: 'old', order: 6 },
      { name: 'Judges', id: 'judges', testament: 'old', order: 7 },
      { name: 'Ruth', id: 'ruth', testament: 'old', order: 8 },
      { name: '1 Samuel', id: 'samuel1', testament: 'old', order: 9 },
      { name: '2 Samuel', id: 'samuel2', testament: 'old', order: 10 },
      { name: '1 Kings', id: 'kings1', testament: 'old', order: 11 },
      { name: '2 Kings', id: 'kings2', testament: 'old', order: 12 },
      { name: '1 Chronicles', id: 'chronicles1', testament: 'old', order: 13 },
      { name: '2 Chronicles', id: 'chronicles2', testament: 'old', order: 14 },
      { name: 'Ezra', id: 'ezra', testament: 'old', order: 15 },
      { name: 'Nehemiah', id: 'nehemiah', testament: 'old', order: 16 },
      { name: 'Esther', id: 'esther', testament: 'old', order: 17 },
      { name: 'Job', id: 'job', testament: 'old', order: 18 },
      { name: 'Psalms', id: 'psalms', testament: 'old', order: 19 },
      { name: 'Proverbs', id: 'proverbs', testament: 'old', order: 20 },
      { name: 'Ecclesiastes', id: 'ecclesiastes', testament: 'old', order: 21 },
      { name: 'Song of Solomon', id: 'songofsolomon', testament: 'old', order: 22 },
      { name: 'Isaiah', id: 'isaiah', testament: 'old', order: 23 },
      { name: 'Jeremiah', id: 'jeremiah', testament: 'old', order: 24 },
      { name: 'Lamentations', id: 'lamentations', testament: 'old', order: 25 },
      { name: 'Ezekiel', id: 'ezekiel', testament: 'old', order: 26 },
      { name: 'Daniel', id: 'daniel', testament: 'old', order: 27 },
      { name: 'Hosea', id: 'hosea', testament: 'old', order: 28 },
      { name: 'Joel', id: 'joel', testament: 'old', order: 29 },
      { name: 'Amos', id: 'amos', testament: 'old', order: 30 },
      { name: 'Obadiah', id: 'obadiah', testament: 'old', order: 31 },
      { name: 'Jonah', id: 'jonah', testament: 'old', order: 32 },
      { name: 'Micah', id: 'micah', testament: 'old', order: 33 },
      { name: 'Nahum', id: 'nahum', testament: 'old', order: 34 },
      { name: 'Habakkuk', id: 'habakkuk', testament: 'old', order: 35 },
      { name: 'Zephaniah', id: 'zephaniah', testament: 'old', order: 36 },
      { name: 'Haggai', id: 'haggai', testament: 'old', order: 37 },
      { name: 'Zechariah', id: 'zechariah', testament: 'old', order: 38 },
      { name: 'Malachi', id: 'malachi', testament: 'old', order: 39 },
      
      // New Testament
      { name: 'Matthew', id: 'matthew', testament: 'new', order: 40 },
      { name: 'Mark', id: 'mark', testament: 'new', order: 41 },
      { name: 'Luke', id: 'luke', testament: 'new', order: 42 },
      { name: 'John', id: 'john', testament: 'new', order: 43 },
      { name: 'Acts', id: 'acts', testament: 'new', order: 44 },
      { name: 'Romans', id: 'romans', testament: 'new', order: 45 },
      { name: '1 Corinthians', id: 'corinthians1', testament: 'new', order: 46 },
      { name: '2 Corinthians', id: 'corinthians2', testament: 'new', order: 47 },
      { name: 'Galatians', id: 'galatians', testament: 'new', order: 48 },
      { name: 'Ephesians', id: 'ephesians', testament: 'new', order: 49 },
      { name: 'Philippians', id: 'philippians', testament: 'new', order: 50 },
      { name: 'Colossians', id: 'colossians', testament: 'new', order: 51 },
      { name: '1 Thessalonians', id: 'thessalonians1', testament: 'new', order: 52 },
      { name: '2 Thessalonians', id: 'thessalonians2', testament: 'new', order: 53 },
      { name: '1 Timothy', id: 'timothy1', testament: 'new', order: 54 },
      { name: '2 Timothy', id: 'timothy2', testament: 'new', order: 55 },
      { name: 'Titus', id: 'titus', testament: 'new', order: 56 },
      { name: 'Philemon', id: 'philemon', testament: 'new', order: 57 },
      { name: 'Hebrews', id: 'hebrews', testament: 'new', order: 58 },
      { name: 'James', id: 'james', testament: 'new', order: 59 },
      { name: '1 Peter', id: 'peter1', testament: 'new', order: 60 },
      { name: '2 Peter', id: 'peter2', testament: 'new', order: 61 },
      { name: '1 John', id: 'john1', testament: 'new', order: 62 },
      { name: '2 John', id: 'john2', testament: 'new', order: 63 },
      { name: '3 John', id: 'john3', testament: 'new', order: 64 },
      { name: 'Jude', id: 'jude', testament: 'new', order: 65 },
      { name: 'Revelation', id: 'revelation', testament: 'new', order: 66 }
    ];

    console.log('✅ Bible books retrieved successfully:', {
      bookCount: books.length,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        books: books,
        total: books.length,
        oldTestament: books.filter(book => book.testament === 'old').length,
        newTestament: books.filter(book => book.testament === 'new').length
      }
    });

  } catch (error) {
    console.error('❌ Get Bible books error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve Bible books',
      message: error.message
    });
  }
});

// Get Daily Prayer (Random unique verse for user)
router.get('/daily-prayer', authenticateToken, async (req, res) => {
  console.log('🙏 Get Daily Prayer Request:', {
    userId: req.user.id,
    userEmail: req.user.email,
    query: req.query,
    bible: req.query.bible,
    category: req.query.category,
    endpoint: '/api/bible/daily-prayer',
    method: 'GET',
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;
    const { bible = null, category = 'all' } = req.query;

    console.log('🔍 Fetching user Bible preference from database...', {
      userId: userId,
      requestedBible: bible,
      category: category,
      timestamp: new Date().toISOString()
    });

    // Get user's preferred Bible version from database
    let userBible = bible;
    if (!userBible) {
      const userResult = await pool.query('SELECT bible_version FROM users WHERE id = $1', [userId]);
      userBible = userResult.rows[0]?.bible_version || 'niv'; // Default to NIV
      
      console.log('📚 User Bible preference retrieved:', {
        userId: userId,
        savedBibleVersion: userResult.rows[0]?.bible_version,
        usingBible: userBible,
        isDefault: !userResult.rows[0]?.bible_version,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('📚 Using requested Bible version:', {
        bible: bible,
        timestamp: new Date().toISOString()
      });
    }

    // Define prayer verses by category (OSIS format for Bible Gateway)
    const prayerVerses = {
      'comfort': [
        'Ps 23:1-4', 'Ps 34:18', 'Ps 46:1', 'Ps 119:76', 'Isa 40:31',
        'Isa 41:10', 'Isa 43:2', 'Jer 29:11', 'Matt 11:28-30', 'John 14:27',
        'John 16:33', 'Rom 8:28', '2Cor 1:3-4', 'Phil 4:6-7'
      ],
      'strength': [
        'Ps 27:1', 'Ps 28:7', 'Ps 46:1', 'Isa 40:29-31', 'Isa 41:10',
        'Eph 6:10', 'Phil 4:13', '2Cor 12:9-10', 'Josh 1:9', 'Deut 31:6'
      ],
      'peace': [
        'John 14:27', 'John 16:33', 'Phil 4:6-7', 'Phil 4:9', 'Ps 29:11',
        'Ps 119:165', 'Isa 26:3', 'Rom 5:1', 'Rom 15:13', 'Col 3:15'
      ],
      'love': [
        'John 3:16', 'John 15:12-13', 'Rom 5:8', 'Rom 8:38-39', '1John 4:7-8',
        '1John 4:16', '1John 4:19', '1Cor 13:4-8', 'Eph 3:17-19'
      ],
      'hope': [
        'Jer 29:11', 'Ps 42:11', 'Ps 130:5', 'Rom 5:3-5', 'Rom 15:13',
        'Heb 11:1', '1Pet 1:3', 'Lam 3:22-23', 'Isa 40:31'
      ],
      'faith': [
        'Heb 11:1', 'Heb 11:6', '2Cor 5:7', 'Eph 2:8-9', 'Rom 10:17',
        'Mark 11:22-24', 'James 1:6', '1John 5:4'
      ],
      'all': [
        'John 3:16', 'Ps 23:1', 'Jer 29:11', 'Phil 4:13', 'Rom 8:28',
        'Prov 3:5-6', 'Matt 28:20', 'Isa 40:31', '1Cor 13:4-7', 'Ps 46:1',
        'John 14:27', 'Rom 5:8', 'Josh 1:9', 'Ps 119:105', 'Matt 11:28-30',
        'Phil 4:6-7', 'Ps 27:1', 'Isa 41:10', 'James 1:2-4', '2Tim 1:7'
      ]
    };

    // Get verses for the selected category
    const categoryVerses = prayerVerses[category] || prayerVerses['all'];
    
    console.log('📖 Prayer category verses loaded:', {
      category: category,
      versesCount: categoryVerses.length,
      firstVerse: categoryVerses[0],
      lastVerse: categoryVerses[categoryVerses.length - 1],
      timestamp: new Date().toISOString()
    });

    // Check if user already has a prayer for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    console.log('🔍 Checking for existing prayer today...', {
      userId: userId,
      bible: userBible,
      category: category,
      today: today.toISOString(),
      tomorrow: tomorrow.toISOString(),
      timestamp: new Date().toISOString()
    });

    const todayPrayerResult = await pool.query(
      `SELECT * FROM user_prayer_history 
       WHERE user_id = $1 AND version = $2 AND category = $3 AND prayed_at >= $4 AND prayed_at < $5
       ORDER BY prayed_at DESC LIMIT 1`,
      [userId, userBible, category, today.toISOString(), tomorrow.toISOString()]
    );

    console.log('📊 Database query result:', {
      foundExistingPrayer: todayPrayerResult.rows.length > 0,
      rowCount: todayPrayerResult.rows.length,
      timestamp: new Date().toISOString()
    });

    if (todayPrayerResult.rows.length > 0) {
      console.log('✅ Returning today\'s cached prayer:', {
        userId: userId,
        bible: userBible,
        category: category,
        reference: todayPrayerResult.rows[0].reference,
        prayedAt: todayPrayerResult.rows[0].prayed_at,
        textPreview: todayPrayerResult.rows[0].text?.substring(0, 50) + '...',
        timestamp: new Date().toISOString()
      });

      console.log('📤 Sending cached prayer to client');

      return res.json({
        success: true,
        data: {
          bible: todayPrayerResult.rows[0].version,
          category: todayPrayerResult.rows[0].category,
          passage: todayPrayerResult.rows[0].reference,
          text: todayPrayerResult.rows[0].text,
          reference: todayPrayerResult.rows[0].reference,
          prayedAt: todayPrayerResult.rows[0].prayed_at,
          isNew: false
        }
      });
    }

    console.log('🎲 No existing prayer found, generating with Gemini AI...', {
      bibleVersion: userBible,
      category: category,
      timestamp: new Date().toISOString()
    });

    // Check if Gemini AI is configured
    if (!genAI) {
      console.error('❌ Gemini AI not configured');
      return res.status(500).json({
        success: false,
        error: 'AI service not configured',
        message: 'Please configure GEMINI_API_KEY in environment variables'
      });
    }

    console.log('🤖 Using Gemini AI to generate daily verse...');

    // Prepare prompt for Gemini AI
    const categoryDescriptions = {
      'comfort': 'comfort, consolation, peace in difficult times, reassurance, God\'s presence',
      'strength': 'strength, courage, perseverance, overcoming challenges, God\'s power',
      'peace': 'peace, calmness, tranquility, rest, inner peace',
      'love': 'God\'s love, compassion, mercy, grace, loving others',
      'hope': 'hope, future, promises, expectations, faith in God\'s plan',
      'faith': 'faith, trust, belief, confidence in God, spiritual growth',
      'all': 'encouragement, daily living, spiritual growth, God\'s word'
    };

    const categoryDesc = categoryDescriptions[category] || categoryDescriptions['all'];
    
    const prompt = `You are a Christian spiritual guide. The user has selected "${userBible}" as their preferred Bible version.

Task: Provide ONE meaningful Bible verse that relates to: ${categoryDesc}

Requirements:
1. Validate that "${userBible}" is a valid Bible version (NIV, KJV, ESV, NLT, NASB, MSG, CSB, AMP, NKJV, etc.)
2. If "${userBible}" is valid, provide a verse from that version
3. If "${userBible}" is not recognized, use NIV as default and mention this
4. Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "isValid": true or false,
  "bibleVersion": "the version used",
  "reference": "Book Chapter:Verse (e.g., John 3:16)",
  "text": "the complete verse text from ${userBible}",
  "message": "optional message if version was changed"
}

Important: Provide an actual, real Bible verse from the specified version. Do not make up verses.`;

    console.log('📝 Gemini AI prompt prepared:', {
      bibleVersion: userBible,
      category: category,
      categoryDescription: categoryDesc,
      timestamp: new Date().toISOString()
    });

    console.log('🌐 Calling Gemini AI API...');

    // Call Gemini AI
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const aiText = response.text();

    console.log('📥 Gemini AI response received:', {
      responseLength: aiText.length,
      responsePreview: aiText.substring(0, 200),
      timestamp: new Date().toISOString()
    });

    // Parse AI response
    let verseData;
    try {
      // Remove markdown code blocks if present
      const cleanedText = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      verseData = JSON.parse(cleanedText);
      
      console.log('✅ AI response parsed successfully:', {
        isValid: verseData.isValid,
        bibleVersion: verseData.bibleVersion,
        reference: verseData.reference,
        hasText: !!verseData.text,
        textLength: verseData.text?.length || 0,
        timestamp: new Date().toISOString()
      });
    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', {
        error: parseError.message,
        aiText: aiText.substring(0, 500),
        timestamp: new Date().toISOString()
      });
      
      return res.status(500).json({
        success: false,
        error: 'Failed to parse AI response',
        message: 'The AI service returned an invalid response'
      });
    }

    const passageText = verseData.text;
    const randomPassage = verseData.reference;
    const actualBibleVersion = verseData.bibleVersion || userBible;

    console.log('📝 Verse data extracted:', {
      originalBibleVersion: userBible,
      actualBibleVersion: actualBibleVersion,
      reference: randomPassage,
      textLength: passageText.length,
      wasValidated: verseData.isValid,
      message: verseData.message,
      timestamp: new Date().toISOString()
    });

    console.log('💾 Saving prayer to database...', {
      userId: userId,
      bible: actualBibleVersion,
      book: randomPassage.split(' ')[0],
      reference: randomPassage,
      category: category,
      textLength: passageText.length,
      timestamp: new Date().toISOString()
    });

    // Save to user's prayer history
    await pool.query(
      `INSERT INTO user_prayer_history 
       (user_id, version, book, chapter, verse, text, reference, category, prayed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (user_id, version, reference) DO UPDATE SET prayed_at = NOW()`,
      [
        userId,
        actualBibleVersion,
        randomPassage.split(' ')[0], // Book (e.g., "John" from "John 3:16")
        0, // Chapter (set to 0 for full passage references)
        0, // Verse (set to 0 for full passage references)
        passageText.substring(0, 500), // Limit text length
        randomPassage,
        category
      ]
    );

    console.log('✅ Prayer saved to database successfully');

    console.log('✅ Daily prayer generated successfully:', {
      userId: userId,
      originalBibleVersion: userBible,
      actualBibleVersion: actualBibleVersion,
      category: category,
      passage: randomPassage,
      textLength: passageText.length,
      isValidVersion: verseData.isValid,
      timestamp: new Date().toISOString()
    });

    console.log('📤 Sending new prayer to client');

    const responseData = {
      bible: actualBibleVersion,
      originalBibleRequested: userBible,
      category: category,
      passage: randomPassage,
      text: passageText,
      reference: randomPassage,
      prayedAt: new Date().toISOString(),
      isNew: true,
      validationMessage: verseData.message || null,
      isValidBibleVersion: verseData.isValid
    };

    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('❌ Get daily prayer error:', {
      userId: req.user.id,
      bible: req.query.bible,
      category: req.query.category,
      error: error.message,
      stack: error.stack,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      timestamp: new Date().toISOString()
    });
    
    if (error.response && error.response.status === 404) {
      console.log('📛 Bible verse not found for daily prayer');
      return res.status(404).json({
        success: false,
        error: 'Bible verse not found',
        message: 'The requested verse could not be found'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve daily prayer',
      message: error.message
    });
  }
});

// Update User Bible Version Preference
router.put('/user-bible-version', authenticateToken, async (req, res) => {
  console.log('📖 Update User Bible Version Request:', {
    userId: req.user.id,
    userEmail: req.user.email,
    body: req.body,
    bibleVersion: req.body.bibleVersion,
    endpoint: '/api/bible/user-bible-version',
    method: 'PUT',
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;
    const { bibleVersion } = req.body;

    console.log('🔍 Validating Bible version parameter:', {
      bibleVersion: bibleVersion,
      hasBibleVersion: !!bibleVersion,
      type: typeof bibleVersion,
      timestamp: new Date().toISOString()
    });

    if (!bibleVersion) {
      console.log('❌ Bible version parameter missing');
      return res.status(400).json({
        success: false,
        error: 'Bible version is required',
        message: 'Please provide a valid Bible version'
      });
    }

    // Basic validation - just check if it's a non-empty string
    if (typeof bibleVersion !== 'string' || bibleVersion.trim().length === 0) {
      console.log('❌ Invalid Bible version format:', {
        version: bibleVersion,
        type: typeof bibleVersion,
        timestamp: new Date().toISOString()
      });
      
      return res.status(400).json({
        success: false,
        error: 'Invalid Bible version format',
        message: 'Bible version must be a non-empty string'
      });
    }

    console.log('✅ Bible version validated (basic check only):', {
      version: bibleVersion,
      length: bibleVersion.length,
      timestamp: new Date().toISOString()
    });

    console.log('💾 Updating user Bible version in database...', {
      userId: userId,
      bibleVersion: bibleVersion,
      timestamp: new Date().toISOString()
    });

    // Update user's Bible version preference
    await pool.query(
      'UPDATE users SET bible_version = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [bibleVersion, userId]
    );

    console.log('✅ Database updated successfully');

    console.log('✅ User Bible version updated successfully:', {
      userId: userId,
      bibleVersion: bibleVersion,
      timestamp: new Date().toISOString()
    });

    console.log('📤 Sending success response to client');

    res.json({
      success: true,
      message: 'Bible version preference updated successfully',
      data: {
        userId: userId,
        bibleVersion: bibleVersion
      }
    });

  } catch (error) {
    console.error('❌ Update user Bible version error:', {
      userId: req.user.id,
      bibleVersion: req.body.bibleVersion,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      error: 'Failed to update Bible version preference',
      message: error.message
    });
  }
});

// Get User Bible Version Preference
router.get('/user-bible-version', authenticateToken, async (req, res) => {
  console.log('📖 Get User Bible Version Request:', {
    userId: req.user.id,
    userEmail: req.user.email,
    endpoint: '/api/bible/user-bible-version',
    method: 'GET',
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;

    console.log('🔍 Querying database for user Bible version...', {
      userId: userId,
      timestamp: new Date().toISOString()
    });

    const result = await pool.query(
      'SELECT bible_version FROM users WHERE id = $1',
      [userId]
    );

    console.log('📊 Database query result:', {
      rowCount: result.rowCount,
      hasRows: result.rows.length > 0,
      savedBibleVersion: result.rows[0]?.bible_version,
      timestamp: new Date().toISOString()
    });

    const bibleVersion = result.rows[0]?.bible_version || 'niv'; // Default to NIV

    console.log('✅ User Bible version retrieved successfully:', {
      userId: userId,
      bibleVersion: bibleVersion,
      isDefault: !result.rows[0]?.bible_version,
      timestamp: new Date().toISOString()
    });

    console.log('📤 Sending Bible version to client');

    res.json({
      success: true,
      data: {
        userId: userId,
        bibleVersion: bibleVersion
      }
    });

  } catch (error) {
    console.error('❌ Get user Bible version error:', {
      userId: req.user.id,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve Bible version preference',
      message: error.message
    });
  }
});

// Get User Prayer History
router.get('/prayer-history', authenticateToken, async (req, res) => {
  console.log('📖 Get Prayer History Request:', {
    userId: req.user.id,
    query: req.query,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;
    const { 
      version = 'all', 
      category = 'all', 
      limit = 20, 
      offset = 0 
    } = req.query;

    // Build query
    let query = `
      SELECT version, book, chapter, verse, text, reference, category, prayed_at
      FROM user_prayer_history
      WHERE user_id = $1
    `;
    
    const queryParams = [userId];
    let paramCount = 1;

    if (version !== 'all') {
      paramCount++;
      query += ` AND version = $${paramCount}`;
      queryParams.push(version);
    }

    if (category !== 'all') {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      queryParams.push(category);
    }

    query += ` ORDER BY prayed_at DESC`;

    // Add pagination
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    queryParams.push(parseInt(limit));

    paramCount++;
    query += ` OFFSET $${paramCount}`;
    queryParams.push(parseInt(offset));

    const historyResult = await pool.query(query, queryParams);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM user_prayer_history
      WHERE user_id = $1
    `;
    
    const countParams = [userId];
    let countParamCount = 1;

    if (version !== 'all') {
      countParamCount++;
      countQuery += ` AND version = $${countParamCount}`;
      countParams.push(version);
    }

    if (category !== 'all') {
      countParamCount++;
      countQuery += ` AND category = $${countParamCount}`;
      countParams.push(category);
    }

    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].total);

    console.log('✅ Prayer history retrieved successfully:', {
      userId: userId,
      prayerCount: historyResult.rows.length,
      totalCount: totalCount,
      version: version,
      category: category,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        prayers: historyResult.rows,
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
        },
        filters: {
          version,
          category
        }
      }
    });

  } catch (error) {
    console.error('❌ Get prayer history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve prayer history',
      message: error.message
    });
  }
});

// Get Prayer Statistics
router.get('/prayer-stats', authenticateToken, async (req, res) => {
  console.log('📊 Get Prayer Stats Request:', {
    userId: req.user.id,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;

    // Get total prayers
    const totalResult = await pool.query(
      `SELECT COUNT(*) as total FROM user_prayer_history WHERE user_id = $1`,
      [userId]
    );

    // Get prayers by category
    const categoryResult = await pool.query(
      `SELECT category, COUNT(*) as count 
       FROM user_prayer_history 
       WHERE user_id = $1 
       GROUP BY category 
       ORDER BY count DESC`,
      [userId]
    );

    // Get prayers by version
    const versionResult = await pool.query(
      `SELECT version, COUNT(*) as count 
       FROM user_prayer_history 
       WHERE user_id = $1 
       GROUP BY version 
       ORDER BY count DESC`,
      [userId]
    );

    // Get recent prayers (last 7 days)
    const recentResult = await pool.query(
      `SELECT COUNT(*) as recent 
       FROM user_prayer_history 
       WHERE user_id = $1 AND prayed_at >= NOW() - INTERVAL '7 days'`,
      [userId]
    );

    // Get current streak (consecutive days with prayers)
    const streakResult = await pool.query(
      `WITH daily_prayers AS (
         SELECT DATE(prayed_at) as prayer_date
         FROM user_prayer_history 
         WHERE user_id = $1
         GROUP BY DATE(prayed_at)
         ORDER BY prayer_date DESC
       ),
       streaks AS (
         SELECT prayer_date,
                ROW_NUMBER() OVER (ORDER BY prayer_date DESC) - 
                ROW_NUMBER() OVER (PARTITION BY prayer_date - (ROW_NUMBER() OVER (ORDER BY prayer_date DESC) * INTERVAL '1 day') ORDER BY prayer_date DESC) as streak_group
         FROM daily_prayers
       )
       SELECT COUNT(*) as current_streak
       FROM streaks 
       WHERE streak_group = 0`,
      [userId]
    );

    console.log('✅ Prayer stats retrieved successfully:', {
      userId: userId,
      totalPrayers: totalResult.rows[0].total,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        totalPrayers: parseInt(totalResult.rows[0].total),
        recentPrayers: parseInt(recentResult.rows[0].recent),
        currentStreak: parseInt(streakResult.rows[0].current_streak) || 0,
        byCategory: categoryResult.rows,
        byVersion: versionResult.rows
      }
    });

  } catch (error) {
    console.error('❌ Get prayer stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve prayer statistics',
      message: error.message
    });
  }
});

// Get Daily Reflection (Random unique verse with reflection theme for user)
router.get('/daily-reflection', authenticateToken, async (req, res) => {
  console.log('🤔 Get Daily Reflection Request:', {
    userId: req.user.id,
    query: req.query,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;
    const { version = 'en-kjv', theme = 'gratitude' } = req.query;

    // Define reflection themes with specific verses and prompts
    const reflectionThemes = {
      'gratitude': {
        verses: [
          { book: 'psalms', chapter: 100, verse: 4 },
          { book: 'thessalonians1', chapter: 5, verse: 18 },
          { book: 'psalms', chapter: 103, verse: 1 },
          { book: 'colossians', chapter: 3, verse: 17 },
          { book: 'psalms', chapter: 107, verse: 1 },
          { book: 'ephesians', chapter: 5, verse: 20 },
          { book: 'psalms', chapter: 118, verse: 1 },
          { book: 'corinthians2', chapter: 9, verse: 15 }
        ],
        prompt: "Today's Reflection: Gratitude",
        questions: [
          "What are three things you're grateful for today?",
          "How does this verse inspire you to be more thankful?",
          "Who in your life deserves your gratitude today?",
          "What challenges can you view as opportunities for growth?",
          "How can you express gratitude to God today?"
        ]
      },
      'forgiveness': {
        verses: [
          { book: 'matthew', chapter: 6, verse: 14 },
          { book: 'ephesians', chapter: 4, verse: 32 },
          { book: 'colossians', chapter: 3, verse: 13 },
          { book: 'luke', chapter: 17, verse: 4 },
          { book: 'psalms', chapter: 32, verse: 1 },
          { book: 'matthew', chapter: 18, verse: 22 },
          { book: 'romans', chapter: 12, verse: 20 },
          { book: 'psalms', chapter: 86, verse: 5 }
        ],
        prompt: "Today's Reflection: Forgiveness",
        questions: [
          "Is there someone you need to forgive today?",
          "How does holding onto grudges affect your peace?",
          "What does this verse teach about God's forgiveness?",
          "How can you practice forgiveness in small ways today?",
          "What would it feel like to let go of past hurts?"
        ]
      },
      'faith': {
        verses: [
          { book: 'hebrews', chapter: 11, verse: 1 },
          { book: 'matthew', chapter: 17, verse: 20 },
          { book: 'mark', chapter: 9, verse: 23 },
          { book: 'romans', chapter: 10, verse: 17 },
          { book: 'corinthians2', chapter: 5, verse: 7 },
          { book: 'psalms', chapter: 37, verse: 5 },
          { book: 'proverbs', chapter: 3, verse: 5 },
          { book: 'isaiah', chapter: 26, verse: 3 }
        ],
        prompt: "Today's Reflection: Faith",
        questions: [
          "What does faith mean to you personally?",
          "How has your faith been tested recently?",
          "What step of faith is God calling you to take?",
          "How can you strengthen your faith today?",
          "What evidence of God's faithfulness do you see around you?"
        ]
      },
      'love': {
        verses: [
          { book: 'john', chapter: 15, verse: 13 },
          { book: 'corinthians1', chapter: 13, verse: 4 },
          { book: 'romans', chapter: 8, verse: 38 },
          { book: 'john', chapter: 3, verse: 16 },
          { book: 'psalms', chapter: 136, verse: 1 },
          { book: 'ephesians', chapter: 3, verse: 19 },
          { book: 'john', chapter: 4, verse: 19 },
          { book: 'psalms', chapter: 103, verse: 8 }
        ],
        prompt: "Today's Reflection: Love",
        questions: [
          "How can you show love to someone today?",
          "What does unconditional love look like in practice?",
          "Who in your life needs to feel loved today?",
          "How does God's love change how you see yourself?",
          "What barriers to love do you need to overcome?"
        ]
      },
      'hope': {
        verses: [
          { book: 'jeremiah', chapter: 29, verse: 11 },
          { book: 'romans', chapter: 15, verse: 13 },
          { book: 'psalms', chapter: 42, verse: 11 },
          { book: 'isaiah', chapter: 40, verse: 31 },
          { book: 'romans', chapter: 8, verse: 24 },
          { book: 'psalms', chapter: 71, verse: 14 },
          { book: 'corinthians2', chapter: 4, verse: 16 },
          { book: 'psalms', chapter: 130, verse: 5 }
        ],
        prompt: "Today's Reflection: Hope",
        questions: [
          "What are you hoping for in this season?",
          "How does this verse give you hope?",
          "What dreams has God placed in your heart?",
          "How can you be a source of hope to others?",
          "What would you do if you knew you couldn't fail?"
        ]
      },
      'peace': {
        verses: [
          { book: 'philippians', chapter: 4, verse: 7 },
          { book: 'john', chapter: 14, verse: 27 },
          { book: 'psalms', chapter: 29, verse: 11 },
          { book: 'isaiah', chapter: 26, verse: 3 },
          { book: 'psalms', chapter: 4, verse: 8 },
          { book: 'romans', chapter: 5, verse: 1 },
          { book: 'psalms', chapter: 85, verse: 8 },
          { book: 'colossians', chapter: 3, verse: 15 }
        ],
        prompt: "Today's Reflection: Peace",
        questions: [
          "What is stealing your peace today?",
          "How can you find peace in the midst of chaos?",
          "What practices help you feel peaceful?",
          "How can you bring peace to a difficult situation?",
          "What does God's peace feel like to you?"
        ]
      },
      'strength': {
        verses: [
          { book: 'philippians', chapter: 4, verse: 13 },
          { book: 'isaiah', chapter: 40, verse: 31 },
          { book: 'psalms', chapter: 27, verse: 1 },
          { book: 'ephesians', chapter: 6, verse: 10 },
          { book: 'psalms', chapter: 18, verse: 2 },
          { book: 'corinthians2', chapter: 12, verse: 9 },
          { book: 'psalms', chapter: 28, verse: 7 },
          { book: 'romans', chapter: 8, verse: 37 }
        ],
        prompt: "Today's Reflection: Strength",
        questions: [
          "What challenge requires God's strength today?",
          "How has God strengthened you in the past?",
          "What weakness can God turn into strength?",
          "How can you encourage someone who feels weak?",
          "What does it mean to be strong in the Lord?"
        ]
      },
      'wisdom': {
        verses: [
          { book: 'proverbs', chapter: 3, verse: 5 },
          { book: 'james', chapter: 1, verse: 5 },
          { book: 'proverbs', chapter: 2, verse: 6 },
          { book: 'psalms', chapter: 111, verse: 10 },
          { book: 'proverbs', chapter: 9, verse: 10 },
          { book: 'corinthians1', chapter: 1, verse: 25 },
          { book: 'proverbs', chapter: 4, verse: 7 },
          { book: 'ecclesiastes', chapter: 7, verse: 12 }
        ],
        prompt: "Today's Reflection: Wisdom",
        questions: [
          "What decision requires God's wisdom today?",
          "How can you seek wisdom in your daily choices?",
          "What foolish patterns do you need to break?",
          "How can you learn from wise people around you?",
          "What does it mean to fear the Lord?"
        ]
      }
    };

    // Get available verses for the selected theme
    const themeData = reflectionThemes[theme] || reflectionThemes['gratitude'];
    const availableVerses = themeData.verses;

    // Check if user already has a reflection for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const todayReflectionResult = await pool.query(
      `SELECT * FROM user_reflection_history 
       WHERE user_id = $1 AND version = $2 AND theme = $3 AND reflected_at >= $4 AND reflected_at < $5`,
      [userId, version, theme, today.toISOString(), tomorrow.toISOString()]
    );

    if (todayReflectionResult.rows.length > 0) {
      console.log('✅ Returning today\'s reflection:', {
        userId: userId,
        version: version,
        theme: theme,
        book: todayReflectionResult.rows[0].book,
        chapter: todayReflectionResult.rows[0].chapter,
        verse: todayReflectionResult.rows[0].verse
      });

      return res.json({
        success: true,
        data: {
          version: todayReflectionResult.rows[0].version,
          theme: todayReflectionResult.rows[0].theme,
          book: todayReflectionResult.rows[0].book,
          chapter: todayReflectionResult.rows[0].chapter,
          verse: todayReflectionResult.rows[0].verse,
          text: todayReflectionResult.rows[0].text,
          reference: todayReflectionResult.rows[0].reference,
          reflectionPrompt: todayReflectionResult.rows[0].reflection_prompt,
          reflectionQuestions: todayReflectionResult.rows[0].reflection_questions,
          reflectedAt: todayReflectionResult.rows[0].reflected_at,
          isNew: false
        }
      });
    }

    // Get user's reflection history to find verses they haven't reflected on yet
    const historyResult = await pool.query(
      `SELECT version, book, chapter, verse 
       FROM user_reflection_history 
       WHERE user_id = $1 AND version = $2 AND theme = $3`,
      [userId, version, theme]
    );

    const reflectedVerses = new Set(
      historyResult.rows.map(row => 
        `${row.book}-${row.chapter}-${row.verse}`
      )
    );

    // Filter out verses the user has already reflected on
    const unReflectedVerses = availableVerses.filter(verse => 
      !reflectedVerses.has(`${verse.book}-${verse.chapter}-${verse.verse}`)
    );

    // If user has reflected on all verses in this theme, reset and start over
    let selectedVerse;
    if (unReflectedVerses.length === 0) {
      console.log('🔄 User has reflected on all verses in theme, resetting history');
      
      // Clear user's reflection history for this theme and version
      await pool.query(
        `DELETE FROM user_reflection_history 
         WHERE user_id = $1 AND version = $2 AND theme = $3`,
        [userId, version, theme]
      );
      
      // Select from all available verses
      selectedVerse = availableVerses[Math.floor(Math.random() * availableVerses.length)];
    } else {
      // Select a random verse from un-reflected verses
      selectedVerse = availableVerses[Math.floor(Math.random() * availableVerses.length)];
    }

    // Fetch the verse text from Bible API
    const url = `${BIBLE_API_BASE}/${version}/books/${selectedVerse.book}/chapters/${selectedVerse.chapter}/verses/${selectedVerse.verse}.json`;
    const response = await axios.get(url);

    // Save to user's reflection history
    await pool.query(
      `INSERT INTO user_reflection_history 
       (user_id, version, book, chapter, verse, text, reference, theme, reflection_prompt, reflection_questions, reflected_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (user_id, version, book, chapter, verse, theme) DO NOTHING`,
      [
        userId,
        version,
        selectedVerse.book,
        selectedVerse.chapter,
        selectedVerse.verse,
        response.data.text,
        `${selectedVerse.book} ${selectedVerse.chapter}:${selectedVerse.verse}`,
        theme,
        themeData.prompt,
        themeData.questions
      ]
    );

    console.log('✅ Daily reflection retrieved successfully:', {
      userId: userId,
      version: version,
      theme: theme,
      book: selectedVerse.book,
      chapter: selectedVerse.chapter,
      verse: selectedVerse.verse,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        version: version,
        theme: theme,
        book: selectedVerse.book,
        chapter: selectedVerse.chapter,
        verse: selectedVerse.verse,
        text: response.data.text,
        reference: `${selectedVerse.book} ${selectedVerse.chapter}:${selectedVerse.verse}`,
        reflectionPrompt: themeData.prompt,
        reflectionQuestions: themeData.questions,
        reflectedAt: new Date().toISOString(),
        remainingVerses: unReflectedVerses.length - 1,
        totalVersesInTheme: availableVerses.length,
        isNew: true
      }
    });

  } catch (error) {
    console.error('❌ Get daily reflection error:', error);
    
    if (error.response && error.response.status === 404) {
      return res.status(404).json({
        success: false,
        error: 'Bible verse not found',
        message: 'The requested verse could not be found'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve daily reflection',
      message: error.message
    });
  }
});

// Get User Reflection History
router.get('/reflection-history', authenticateToken, async (req, res) => {
  console.log('📖 Get Reflection History Request:', {
    userId: req.user.id,
    query: req.query,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;
    const { 
      version = 'all', 
      theme = 'all', 
      limit = 20, 
      offset = 0 
    } = req.query;

    // Build query
    let query = `
      SELECT version, book, chapter, verse, text, reference, theme, reflection_prompt, reflection_questions, reflected_at
      FROM user_reflection_history
      WHERE user_id = $1
    `;
    
    const queryParams = [userId];
    let paramCount = 1;

    if (version !== 'all') {
      paramCount++;
      query += ` AND version = $${paramCount}`;
      queryParams.push(version);
    }

    if (theme !== 'all') {
      paramCount++;
      query += ` AND theme = $${paramCount}`;
      queryParams.push(theme);
    }

    query += ` ORDER BY reflected_at DESC`;

    // Add pagination
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    queryParams.push(parseInt(limit));

    paramCount++;
    query += ` OFFSET $${paramCount}`;
    queryParams.push(parseInt(offset));

    const historyResult = await pool.query(query, queryParams);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM user_reflection_history
      WHERE user_id = $1
    `;
    
    const countParams = [userId];
    let countParamCount = 1;

    if (version !== 'all') {
      countParamCount++;
      countQuery += ` AND version = $${countParamCount}`;
      countParams.push(version);
    }

    if (theme !== 'all') {
      countParamCount++;
      countQuery += ` AND theme = $${countParamCount}`;
      countParams.push(theme);
    }

    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].total);

    console.log('✅ Reflection history retrieved successfully:', {
      userId: userId,
      reflectionCount: historyResult.rows.length,
      totalCount: totalCount,
      version: version,
      theme: theme,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        reflections: historyResult.rows,
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
        },
        filters: {
          version,
          theme
        }
      }
    });

  } catch (error) {
    console.error('❌ Get reflection history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve reflection history',
      message: error.message
    });
  }
});

// Get Reflection Statistics
router.get('/reflection-stats', authenticateToken, async (req, res) => {
  console.log('📊 Get Reflection Stats Request:', {
    userId: req.user.id,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;

    // Get total reflections
    const totalResult = await pool.query(
      `SELECT COUNT(*) as total FROM user_reflection_history WHERE user_id = $1`,
      [userId]
    );

    // Get reflections by theme
    const themeResult = await pool.query(
      `SELECT theme, COUNT(*) as count 
       FROM user_reflection_history 
       WHERE user_id = $1 
       GROUP BY theme 
       ORDER BY count DESC`,
      [userId]
    );

    // Get reflections by version
    const versionResult = await pool.query(
      `SELECT version, COUNT(*) as count 
       FROM user_reflection_history 
       WHERE user_id = $1 
       GROUP BY version 
       ORDER BY count DESC`,
      [userId]
    );

    // Get recent reflections (last 7 days)
    const recentResult = await pool.query(
      `SELECT COUNT(*) as recent 
       FROM user_reflection_history 
       WHERE user_id = $1 AND reflected_at >= NOW() - INTERVAL '7 days'`,
      [userId]
    );

    // Get current streak (consecutive days with reflections)
    const streakResult = await pool.query(
      `WITH daily_reflections AS (
         SELECT DATE(reflected_at) as reflection_date
         FROM user_reflection_history 
         WHERE user_id = $1
         GROUP BY DATE(reflected_at)
         ORDER BY reflection_date DESC
       ),
       streaks AS (
         SELECT reflection_date,
                ROW_NUMBER() OVER (ORDER BY reflection_date DESC) - 
                ROW_NUMBER() OVER (PARTITION BY reflection_date - (ROW_NUMBER() OVER (ORDER BY reflection_date DESC) * INTERVAL '1 day') ORDER BY reflection_date DESC) as streak_group
         FROM daily_reflections
       )
       SELECT COUNT(*) as current_streak
       FROM streaks 
       WHERE streak_group = 0`,
      [userId]
    );

    console.log('✅ Reflection stats retrieved successfully:', {
      userId: userId,
      totalReflections: totalResult.rows[0].total,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        totalReflections: parseInt(totalResult.rows[0].total),
        recentReflections: parseInt(recentResult.rows[0].recent),
        currentStreak: parseInt(streakResult.rows[0].current_streak) || 0,
        byTheme: themeResult.rows,
        byVersion: versionResult.rows
      }
    });

  } catch (error) {
    console.error('❌ Get reflection stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve reflection statistics',
      message: error.message
    });
  }
});

// Get Available Reflection Themes
router.get('/reflection-themes', authenticateToken, async (req, res) => {
  console.log('🎨 Get Reflection Themes Request:', {
    userId: req.user.id,
    timestamp: new Date().toISOString()
  });

  try {
    const themes = [
      {
        id: 'gratitude',
        name: 'Gratitude',
        description: 'Reflect on thankfulness and appreciation',
        color: '#4CAF50'
      },
      {
        id: 'forgiveness',
        name: 'Forgiveness',
        description: 'Explore healing and letting go',
        color: '#FF9800'
      },
      {
        id: 'faith',
        name: 'Faith',
        description: 'Deepen your trust and belief',
        color: '#2196F3'
      },
      {
        id: 'love',
        name: 'Love',
        description: 'Reflect on love in all its forms',
        color: '#E91E63'
      },
      {
        id: 'hope',
        name: 'Hope',
        description: 'Find encouragement and optimism',
        color: '#9C27B0'
      },
      {
        id: 'peace',
        name: 'Peace',
        description: 'Seek calm and tranquility',
        color: '#00BCD4'
      },
      {
        id: 'strength',
        name: 'Strength',
        description: 'Build resilience and courage',
        color: '#FF5722'
      },
      {
        id: 'wisdom',
        name: 'Wisdom',
        description: 'Grow in understanding and discernment',
        color: '#795548'
      }
    ];

    console.log('✅ Reflection themes retrieved successfully:', {
      themeCount: themes.length,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        themes: themes,
        total: themes.length
      }
    });

  } catch (error) {
    console.error('❌ Get reflection themes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve reflection themes',
      message: error.message
    });
  }
});

// Get Weekly Study Plan (Generates new plan only once per week)
router.get('/weekly-study-plan', authenticateToken, async (req, res) => {
  console.log('📚 Get Weekly Study Plan Request:', {
    userId: req.user.id,
    query: req.query,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;
    const { version = 'en-kjv', theme = 'random' } = req.query;

    // Get current week start date (Monday)
    const now = new Date();
    const currentWeekStart = new Date(now);
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, Monday = 1
    currentWeekStart.setDate(now.getDate() - daysToMonday);
    currentWeekStart.setHours(0, 0, 0, 0);

    // Get current week end date (Sunday)
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
    currentWeekEnd.setHours(23, 59, 59, 999);

    // Check if user already has a plan for this week
    const existingPlanResult = await pool.query(
      `SELECT * FROM user_weekly_study_plans 
       WHERE user_id = $1 AND week_start_date = $2`,
      [userId, currentWeekStart.toISOString().split('T')[0]]
    );

    if (existingPlanResult.rows.length > 0) {
      console.log('✅ Returning existing weekly study plan:', {
        userId: userId,
        weekStart: currentWeekStart.toISOString().split('T')[0],
        planId: existingPlanResult.rows[0].plan_id
      });

      return res.json({
        success: true,
        data: {
          id: existingPlanResult.rows[0].plan_id,
          title: existingPlanResult.rows[0].title,
          description: existingPlanResult.rows[0].description,
          content: existingPlanResult.rows[0].content,
          weekStart: currentWeekStart.toISOString().split('T')[0],
          weekEnd: currentWeekEnd.toISOString().split('T')[0],
          createdAt: existingPlanResult.rows[0].created_at,
          isNew: false
        }
      });
    }

    // Generate new weekly study plan
    const studyPlanTemplates = [
      {
        id: 'gospel-john',
        title: 'Gospel of John Study',
        description: 'Deep dive into the Gospel of John',
        content: `Weekly Bible Study Plan - Gospel of John:

Monday: Read John 1-3
- Focus on the Word becoming flesh
- Reflect on John 1:14

Tuesday: Study John 3:16-21
- Meditate on God's love for the world
- Consider the meaning of eternal life

Wednesday: Explore John 4:1-42
- Study Jesus' conversation with the Samaritan woman
- Reflect on living water

Thursday: Read John 6:1-71
- Focus on the bread of life discourse
- Consider what it means to believe

Friday: Study John 8:1-59
- Reflect on Jesus as the light of the world
- Consider the concept of truth

Saturday: Read John 10:1-42
- Study the good shepherd parable
- Reflect on Jesus' relationship with his sheep

Sunday: Review and meditate on John 14:1-31
- Focus on Jesus' promise of peace
- Consider what it means to abide in Christ

Remember: Take notes, pray for understanding, and share insights with others.`
      },
      {
        id: 'psalms-prayer',
        title: 'Psalms Prayer Study',
        description: 'Explore the Psalms for prayer and worship',
        content: `Weekly Bible Study Plan - Psalms for Prayer:

Monday: Read Psalms 1-5
- Focus on the blessed man
- Reflect on meditating day and night

Tuesday: Study Psalms 23-25
- The Lord is my shepherd
- Reflect on God's guidance and protection

Wednesday: Explore Psalms 46-50
- God is our refuge and strength
- Consider God's sovereignty

Thursday: Read Psalms 91-95
- Focus on dwelling in God's shelter
- Reflect on God's faithfulness

Friday: Study Psalms 103-107
- Bless the Lord, O my soul
- Consider God's benefits and mercy

Saturday: Read Psalms 139-143
- You have searched me and known me
- Reflect on God's intimate knowledge

Sunday: Review and meditate on Psalms 150
- Let everything that has breath praise the Lord
- Consider how to worship God

Remember: Use these Psalms in your daily prayers and worship.`
      },
      {
        id: 'proverbs-wisdom',
        title: 'Proverbs Wisdom Study',
        description: 'Gain wisdom through Proverbs',
        content: `Weekly Bible Study Plan - Proverbs for Wisdom:

Monday: Read Proverbs 1-3
- The fear of the Lord is the beginning of knowledge
- Reflect on seeking wisdom

Tuesday: Study Proverbs 4-6
- Get wisdom, get understanding
- Consider the path of the righteous

Wednesday: Explore Proverbs 8-10
- Wisdom calls aloud in the street
- Reflect on choosing wisdom over folly

Thursday: Read Proverbs 15-17
- A gentle answer turns away wrath
- Consider the power of words

Friday: Study Proverbs 22-24
- Train up a child in the way he should go
- Reflect on teaching and learning

Saturday: Read Proverbs 30-31
- The words of Agur and King Lemuel
- Consider the excellent wife

Sunday: Review and meditate on key verses
- Choose one proverb to memorize
- Apply wisdom to daily decisions

Remember: Wisdom is more precious than rubies. Seek it daily.`
      },
      {
        id: 'romans-faith',
        title: 'Romans Faith Study',
        description: 'Study the book of Romans for faith understanding',
        content: `Weekly Bible Study Plan - Romans Faith Study:

Monday: Read Romans 1-3
- The righteousness of God revealed
- Reflect on sin and judgment

Tuesday: Study Romans 4-5
- Abraham's faith credited as righteousness
- Consider justification by faith

Wednesday: Explore Romans 6-8
- Dead to sin, alive in Christ
- Reflect on the struggle with sin

Thursday: Read Romans 9-11
- God's sovereignty and Israel
- Consider God's plan for all people

Friday: Study Romans 12-13
- Living sacrifices and love
- Reflect on Christian living

Saturday: Read Romans 14-16
- Accepting one another in love
- Consider unity in diversity

Sunday: Review and meditate on Romans 8:28
- All things work together for good
- Trust in God's plan

Remember: Faith comes by hearing, and hearing by the word of God.`
      },
      {
        id: 'ephesians-church',
        title: 'Ephesians Church Study',
        description: 'Study the church and Christian unity',
        content: `Weekly Bible Study Plan - Ephesians Church Study:

Monday: Read Ephesians 1-2
- Spiritual blessings in Christ
- Reflect on being made alive in Christ

Tuesday: Study Ephesians 3-4
- The mystery of Christ revealed
- Consider unity in the body

Wednesday: Explore Ephesians 5-6
- Walking in love and light
- Reflect on Christian relationships

Thursday: Read Ephesians 6:10-20
- The armor of God
- Consider spiritual warfare

Friday: Study key passages
- Choose one chapter to focus on
- Apply principles to daily life

Saturday: Read and reflect
- Review the week's readings
- Consider how to live as the church

Sunday: Worship and fellowship
- Apply what you've learned
- Share insights with others

Remember: We are one body in Christ. Love one another.`
      }
    ];

    // Select a random template or specific theme
    let selectedTemplate;
    if (theme === 'random') {
      selectedTemplate = studyPlanTemplates[Math.floor(Math.random() * studyPlanTemplates.length)];
    } else {
      selectedTemplate = studyPlanTemplates.find(t => t.id === theme) || studyPlanTemplates[0];
    }

    // Save the new study plan to database
    const insertResult = await pool.query(
      `INSERT INTO user_weekly_study_plans 
       (user_id, plan_id, title, description, content, week_start_date, week_end_date, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [
        userId,
        selectedTemplate.id,
        selectedTemplate.title,
        selectedTemplate.description,
        selectedTemplate.content,
        currentWeekStart.toISOString().split('T')[0],
        currentWeekEnd.toISOString().split('T')[0]
      ]
    );

    console.log('✅ New weekly study plan generated successfully:', {
      userId: userId,
      planId: selectedTemplate.id,
      weekStart: currentWeekStart.toISOString().split('T')[0],
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        id: selectedTemplate.id,
        title: selectedTemplate.title,
        description: selectedTemplate.description,
        content: selectedTemplate.content,
        weekStart: currentWeekStart.toISOString().split('T')[0],
        weekEnd: currentWeekEnd.toISOString().split('T')[0],
        createdAt: insertResult.rows[0].created_at,
        isNew: true
      }
    });

  } catch (error) {
    console.error('❌ Get weekly study plan error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate weekly study plan',
      message: error.message
    });
  }
});

// Get Study Plan History
router.get('/study-plan-history', authenticateToken, async (req, res) => {
  console.log('📚 Get Study Plan History Request:', {
    userId: req.user.id,
    query: req.query,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;
    const { limit = 10, offset = 0 } = req.query;

    // Get study plan history
    const historyResult = await pool.query(
      `SELECT plan_id, title, description, content, week_start_date, week_end_date, created_at
       FROM user_weekly_study_plans
       WHERE user_id = $1
       ORDER BY week_start_date DESC
       LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit), parseInt(offset)]
    );

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM user_weekly_study_plans WHERE user_id = $1`,
      [userId]
    );

    const totalCount = parseInt(countResult.rows[0].total);

    console.log('✅ Study plan history retrieved successfully:', {
      userId: userId,
      planCount: historyResult.rows.length,
      totalCount: totalCount,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        plans: historyResult.rows,
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
        }
      }
    });

  } catch (error) {
    console.error('❌ Get study plan history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve study plan history',
      message: error.message
    });
  }
});

// Get Study Plan Statistics
router.get('/study-plan-stats', authenticateToken, async (req, res) => {
  console.log('📊 Get Study Plan Stats Request:', {
    userId: req.user.id,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;

    // Get total study plans
    const totalResult = await pool.query(
      `SELECT COUNT(*) as total FROM user_weekly_study_plans WHERE user_id = $1`,
      [userId]
    );

    // Get study plans by type
    const typeResult = await pool.query(
      `SELECT plan_id, COUNT(*) as count 
       FROM user_weekly_study_plans 
       WHERE user_id = $1 
       GROUP BY plan_id 
       ORDER BY count DESC`,
      [userId]
    );

    // Get current week's plan
    const now = new Date();
    const currentWeekStart = new Date(now);
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    currentWeekStart.setDate(now.getDate() - daysToMonday);
    currentWeekStart.setHours(0, 0, 0, 0);

    const currentPlanResult = await pool.query(
      `SELECT * FROM user_weekly_study_plans 
       WHERE user_id = $1 AND week_start_date = $2`,
      [userId, currentWeekStart.toISOString().split('T')[0]]
    );

    // Get study streak (consecutive weeks with plans)
    const streakResult = await pool.query(
      `WITH weekly_plans AS (
         SELECT week_start_date
         FROM user_weekly_study_plans 
         WHERE user_id = $1
         ORDER BY week_start_date DESC
       ),
       streaks AS (
         SELECT week_start_date,
                ROW_NUMBER() OVER (ORDER BY week_start_date DESC) - 
                ROW_NUMBER() OVER (PARTITION BY week_start_date - (ROW_NUMBER() OVER (ORDER BY week_start_date DESC) * INTERVAL '7 days') ORDER BY week_start_date DESC) as streak_group
         FROM weekly_plans
       )
       SELECT COUNT(*) as current_streak
       FROM streaks 
       WHERE streak_group = 0`,
      [userId]
    );

    console.log('✅ Study plan stats retrieved successfully:', {
      userId: userId,
      totalPlans: totalResult.rows[0].total,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        totalPlans: parseInt(totalResult.rows[0].total),
        currentStreak: parseInt(streakResult.rows[0].current_streak) || 0,
        byType: typeResult.rows,
        currentWeekPlan: currentPlanResult.rows[0] || null
      }
    });

  } catch (error) {
    console.error('❌ Get study plan stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve study plan statistics',
      message: error.message
    });
  }
});

// Get Available Study Plan Themes
router.get('/study-plan-themes', authenticateToken, async (req, res) => {
  console.log('🎨 Get Study Plan Themes Request:', {
    userId: req.user.id,
    timestamp: new Date().toISOString()
  });

  try {
    const themes = [
      {
        id: 'gospel-john',
        name: 'Gospel of John',
        description: 'Deep dive into the Gospel of John',
        color: '#2196F3',
        duration: '1 week'
      },
      {
        id: 'psalms-prayer',
        name: 'Psalms for Prayer',
        description: 'Explore the Psalms for prayer and worship',
        color: '#4CAF50',
        duration: '1 week'
      },
      {
        id: 'proverbs-wisdom',
        name: 'Proverbs Wisdom',
        description: 'Gain wisdom through Proverbs',
        color: '#FF9800',
        duration: '1 week'
      },
      {
        id: 'romans-faith',
        name: 'Romans Faith Study',
        description: 'Study the book of Romans for faith understanding',
        color: '#9C27B0',
        duration: '1 week'
      },
      {
        id: 'ephesians-church',
        name: 'Ephesians Church Study',
        description: 'Study the church and Christian unity',
        color: '#F44336',
        duration: '1 week'
      },
      {
        id: 'random',
        name: 'Random Theme',
        description: 'Get a random study plan theme',
        color: '#607D8B',
        duration: '1 week'
      }
    ];

    console.log('✅ Study plan themes retrieved successfully:', {
      themeCount: themes.length,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        themes: themes,
        total: themes.length
      }
    });

  } catch (error) {
    console.error('❌ Get study plan themes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve study plan themes',
      message: error.message
    });
  }
});

// Add Prayer Note
router.post('/prayer-notes', authenticateToken, async (req, res) => {
  console.log('📝 Add Prayer Note Request:', {
    userId: req.user.id,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;
    const { title, content, category, tags, isPrivate = true } = req.body;

    // Validate required fields
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Title and content are required'
      });
    }

    // Validate title length
    if (title.length > 200) {
      return res.status(400).json({
        success: false,
        error: 'Title must be 200 characters or less'
      });
    }

    // Insert prayer note
    const insertResult = await pool.query(
      `INSERT INTO user_prayer_notes 
       (user_id, title, content, category, tags, is_private, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [
        userId,
        title.trim(),
        content.trim(),
        category ? category.trim() : null,
        tags && Array.isArray(tags) ? tags : null,
        isPrivate
      ]
    );

    const newNote = insertResult.rows[0];

    console.log('✅ Prayer note added successfully:', {
      userId: userId,
      noteId: newNote.id,
      title: newNote.title,
      timestamp: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      message: 'Prayer note added successfully',
      data: {
        id: newNote.id,
        title: newNote.title,
        content: newNote.content,
        category: newNote.category,
        tags: newNote.tags,
        isPrivate: newNote.is_private,
        createdAt: newNote.created_at,
        updatedAt: newNote.updated_at
      }
    });

  } catch (error) {
    console.error('❌ Add prayer note error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add prayer note',
      message: error.message
    });
  }
});

// Get Prayer Notes
router.get('/prayer-notes', authenticateToken, async (req, res) => {
  console.log('📖 Get Prayer Notes Request:', {
    userId: req.user.id,
    query: req.query,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;
    const { 
      category = 'all', 
      limit = 20, 
      offset = 0,
      search = '',
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    // Validate sortBy
    const allowedSortFields = ['created_at', 'updated_at', 'title'];
    const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const validSortOrder = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Build query
    let query = `
      SELECT id, title, content, category, tags, is_private, created_at, updated_at
      FROM user_prayer_notes
      WHERE user_id = $1
    `;
    
    const queryParams = [userId];
    let paramCount = 1;

    // Add category filter
    if (category !== 'all') {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      queryParams.push(category);
    }

    // Add search filter
    if (search) {
      paramCount++;
      query += ` AND (title ILIKE $${paramCount} OR content ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    // Add sorting
    query += ` ORDER BY ${validSortBy} ${validSortOrder}`;

    // Add pagination
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    queryParams.push(parseInt(limit));

    paramCount++;
    query += ` OFFSET $${paramCount}`;
    queryParams.push(parseInt(offset));

    const notesResult = await pool.query(query, queryParams);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM user_prayer_notes
      WHERE user_id = $1
    `;
    
    const countParams = [userId];
    let countParamCount = 1;

    if (category !== 'all') {
      countParamCount++;
      countQuery += ` AND category = $${countParamCount}`;
      countParams.push(category);
    }

    if (search) {
      countParamCount++;
      countQuery += ` AND (title ILIKE $${countParamCount} OR content ILIKE $${countParamCount})`;
      countParams.push(`%${search}%`);
    }

    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].total);

    console.log('✅ Prayer notes retrieved successfully:', {
      userId: userId,
      noteCount: notesResult.rows.length,
      totalCount: totalCount,
      category: category,
      search: search,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        notes: notesResult.rows,
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
        },
        filters: {
          category,
          search,
          sortBy: validSortBy,
          sortOrder: validSortOrder
        }
      }
    });

  } catch (error) {
    console.error('❌ Get prayer notes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve prayer notes',
      message: error.message
    });
  }
});

// Get Single Prayer Note
router.get('/prayer-notes/:noteId', authenticateToken, async (req, res) => {
  console.log('📖 Get Single Prayer Note Request:', {
    userId: req.user.id,
    noteId: req.params.noteId,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;
    const noteId = parseInt(req.params.noteId);

    if (isNaN(noteId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid note ID'
      });
    }

    const noteResult = await pool.query(
      `SELECT id, title, content, category, tags, is_private, created_at, updated_at
       FROM user_prayer_notes
       WHERE id = $1 AND user_id = $2`,
      [noteId, userId]
    );

    if (noteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Prayer note not found'
      });
    }

    console.log('✅ Prayer note retrieved successfully:', {
      userId: userId,
      noteId: noteId,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: noteResult.rows[0]
    });

  } catch (error) {
    console.error('❌ Get single prayer note error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve prayer note',
      message: error.message
    });
  }
});

// Update Prayer Note
router.put('/prayer-notes/:noteId', authenticateToken, async (req, res) => {
  console.log('✏️ Update Prayer Note Request:', {
    userId: req.user.id,
    noteId: req.params.noteId,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;
    const noteId = parseInt(req.params.noteId);
    const { title, content, category, tags, isPrivate } = req.body;

    if (isNaN(noteId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid note ID'
      });
    }

    // Check if note exists and belongs to user
    const existingNoteResult = await pool.query(
      `SELECT id FROM user_prayer_notes WHERE id = $1 AND user_id = $2`,
      [noteId, userId]
    );

    if (existingNoteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Prayer note not found'
      });
    }

    // Validate required fields
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Title and content are required'
      });
    }

    // Validate title length
    if (title.length > 200) {
      return res.status(400).json({
        success: false,
        error: 'Title must be 200 characters or less'
      });
    }

    // Update prayer note
    const updateResult = await pool.query(
      `UPDATE user_prayer_notes 
       SET title = $1, content = $2, category = $3, tags = $4, is_private = $5, updated_at = NOW()
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [
        title.trim(),
        content.trim(),
        category ? category.trim() : null,
        tags && Array.isArray(tags) ? tags : null,
        isPrivate,
        noteId,
        userId
      ]
    );

    const updatedNote = updateResult.rows[0];

    console.log('✅ Prayer note updated successfully:', {
      userId: userId,
      noteId: noteId,
      title: updatedNote.title,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Prayer note updated successfully',
      data: {
        id: updatedNote.id,
        title: updatedNote.title,
        content: updatedNote.content,
        category: updatedNote.category,
        tags: updatedNote.tags,
        isPrivate: updatedNote.is_private,
        createdAt: updatedNote.created_at,
        updatedAt: updatedNote.updated_at
      }
    });

  } catch (error) {
    console.error('❌ Update prayer note error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update prayer note',
      message: error.message
    });
  }
});

// Delete Prayer Note
router.delete('/prayer-notes/:noteId', authenticateToken, async (req, res) => {
  console.log('🗑️ Delete Prayer Note Request:', {
    userId: req.user.id,
    noteId: req.params.noteId,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;
    const noteId = parseInt(req.params.noteId);

    if (isNaN(noteId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid note ID'
      });
    }

    // Check if note exists and belongs to user
    const existingNoteResult = await pool.query(
      `SELECT id, title FROM user_prayer_notes WHERE id = $1 AND user_id = $2`,
      [noteId, userId]
    );

    if (existingNoteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Prayer note not found'
      });
    }

    // Delete prayer note
    await pool.query(
      `DELETE FROM user_prayer_notes WHERE id = $1 AND user_id = $2`,
      [noteId, userId]
    );

    console.log('✅ Prayer note deleted successfully:', {
      userId: userId,
      noteId: noteId,
      title: existingNoteResult.rows[0].title,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Prayer note deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete prayer note error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete prayer note',
      message: error.message
    });
  }
});

// Get Prayer Note Categories
router.get('/prayer-notes/categories', authenticateToken, async (req, res) => {
  console.log('🏷️ Get Prayer Note Categories Request:', {
    userId: req.user.id,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;

    const categoriesResult = await pool.query(
      `SELECT category, COUNT(*) as count 
       FROM user_prayer_notes 
       WHERE user_id = $1 AND category IS NOT NULL
       GROUP BY category 
       ORDER BY count DESC, category ASC`,
      [userId]
    );

    console.log('✅ Prayer note categories retrieved successfully:', {
      userId: userId,
      categoryCount: categoriesResult.rows.length,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        categories: categoriesResult.rows
      }
    });

  } catch (error) {
    console.error('❌ Get prayer note categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve prayer note categories',
      message: error.message
    });
  }
});

// Update Daily Activity
router.post('/daily-activity', authenticateToken, async (req, res) => {
  console.log('📝 Update Daily Activity Request:', {
    userId: req.user.id,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;
    const { 
      versesRead = 0, 
      prayersSaid = 0, 
      reflectionsCompleted = 0, 
      studyHours = 0, 
      notesCreated = 0,
      date = new Date().toISOString().split('T')[0]
    } = req.body;

    // Validate inputs
    if (versesRead < 0 || prayersSaid < 0 || reflectionsCompleted < 0 || studyHours < 0 || notesCreated < 0) {
      return res.status(400).json({
        success: false,
        error: 'Activity values cannot be negative'
      });
    }

    // Upsert daily activity (add to existing values)
    const upsertResult = await pool.query(
      `INSERT INTO user_daily_activities 
       (user_id, activity_date, verses_read, prayers_said, reflections_completed, study_hours, notes_created, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (user_id, activity_date) 
       DO UPDATE SET 
         verses_read = user_daily_activities.verses_read + $3,
         prayers_said = user_daily_activities.prayers_said + $4,
         reflections_completed = user_daily_activities.reflections_completed + $5,
         study_hours = user_daily_activities.study_hours + $6,
         notes_created = user_daily_activities.notes_created + $7,
         updated_at = NOW()
       RETURNING *`,
      [userId, date, versesRead, prayersSaid, reflectionsCompleted, studyHours, notesCreated]
    );

    console.log('✅ Daily activity updated successfully:', {
      userId: userId,
      date: date,
      versesRead: versesRead,
      prayersSaid: prayersSaid,
      reflectionsCompleted: reflectionsCompleted,
      studyHours: studyHours,
      notesCreated: notesCreated,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Daily activity updated successfully',
      data: {
        date: upsertResult.rows[0].activity_date,
        versesRead: upsertResult.rows[0].verses_read,
        prayersSaid: upsertResult.rows[0].prayers_said,
        reflectionsCompleted: upsertResult.rows[0].reflections_completed,
        studyHours: parseFloat(upsertResult.rows[0].study_hours),
        notesCreated: upsertResult.rows[0].notes_created,
        updatedAt: upsertResult.rows[0].updated_at
      }
    });

  } catch (error) {
    console.error('❌ Update daily activity error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update daily activity',
      message: error.message
    });
  }
});

// Get Daily Activity Stats
router.get('/daily-activity/stats', authenticateToken, async (req, res) => {
  console.log('📊 Get Daily Activity Stats Request:', {
    userId: req.user.id,
    query: req.query,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;
    const { 
      period = '30', // days
      date = new Date().toISOString().split('T')[0]
    } = req.query;

    const daysBack = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get today's activity
    const todayResult = await pool.query(
      `SELECT verses_read, prayers_said, reflections_completed, study_hours, notes_created
       FROM user_daily_activities 
       WHERE user_id = $1 AND activity_date = $2`,
      [userId, date]
    );

    // Get period totals
    const periodResult = await pool.query(
      `SELECT 
         COALESCE(SUM(verses_read), 0) as total_verses_read,
         COALESCE(SUM(prayers_said), 0) as total_prayers_said,
         COALESCE(SUM(reflections_completed), 0) as total_reflections_completed,
         COALESCE(SUM(study_hours), 0) as total_study_hours,
         COALESCE(SUM(notes_created), 0) as total_notes_created,
         COUNT(*) as active_days
       FROM user_daily_activities 
       WHERE user_id = $1 AND activity_date >= $2`,
      [userId, startDateStr]
    );

    // Get current streak (consecutive days with any activity)
    const streakResult = await pool.query(
      `WITH daily_activities AS (
         SELECT activity_date
         FROM user_daily_activities 
         WHERE user_id = $1
         ORDER BY activity_date DESC
       ),
       streaks AS (
         SELECT activity_date,
                ROW_NUMBER() OVER (ORDER BY activity_date DESC) - 
                ROW_NUMBER() OVER (PARTITION BY activity_date - (ROW_NUMBER() OVER (ORDER BY activity_date DESC) * INTERVAL '1 day') ORDER BY activity_date DESC) as streak_group
         FROM daily_activities
       )
       SELECT COUNT(*) as current_streak
       FROM streaks 
       WHERE streak_group = 0`,
      [userId]
    );

    // Get weekly averages
    const weeklyAvgResult = await pool.query(
      `SELECT 
         COALESCE(AVG(verses_read), 0) as avg_verses_read,
         COALESCE(AVG(prayers_said), 0) as avg_prayers_said,
         COALESCE(AVG(reflections_completed), 0) as avg_reflections_completed,
         COALESCE(AVG(study_hours), 0) as avg_study_hours,
         COALESCE(AVG(notes_created), 0) as avg_notes_created
       FROM user_daily_activities 
       WHERE user_id = $1 AND activity_date >= $2`,
      [userId, startDateStr]
    );

    console.log('✅ Daily activity stats retrieved successfully:', {
      userId: userId,
      period: period,
      currentStreak: streakResult.rows[0].current_streak,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        today: todayResult.rows[0] || {
          verses_read: 0,
          prayers_said: 0,
          reflections_completed: 0,
          study_hours: 0,
          notes_created: 0
        },
        period: {
          totalVersesRead: parseInt(periodResult.rows[0].total_verses_read),
          totalPrayersSaid: parseInt(periodResult.rows[0].total_prayers_said),
          totalReflectionsCompleted: parseInt(periodResult.rows[0].total_reflections_completed),
          totalStudyHours: parseFloat(periodResult.rows[0].total_study_hours),
          totalNotesCreated: parseInt(periodResult.rows[0].total_notes_created),
          activeDays: parseInt(periodResult.rows[0].active_days)
        },
        averages: {
          versesRead: parseFloat(weeklyAvgResult.rows[0].avg_verses_read),
          prayersSaid: parseFloat(weeklyAvgResult.rows[0].avg_prayers_said),
          reflectionsCompleted: parseFloat(weeklyAvgResult.rows[0].avg_reflections_completed),
          studyHours: parseFloat(weeklyAvgResult.rows[0].avg_study_hours),
          notesCreated: parseFloat(weeklyAvgResult.rows[0].avg_notes_created)
        },
        currentStreak: parseInt(streakResult.rows[0].current_streak) || 0,
        periodDays: daysBack
      }
    });

  } catch (error) {
    console.error('❌ Get daily activity stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve daily activity stats',
      message: error.message
    });
  }
});

// Get Activity History
router.get('/daily-activity/history', authenticateToken, async (req, res) => {
  console.log('📈 Get Activity History Request:', {
    userId: req.user.id,
    query: req.query,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;
    const { 
      period = '30', 
      limit = 30, 
      offset = 0 
    } = req.query;

    const daysBack = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get activity history
    const historyResult = await pool.query(
      `SELECT activity_date, verses_read, prayers_said, reflections_completed, study_hours, notes_created
       FROM user_daily_activities 
       WHERE user_id = $1 AND activity_date >= $2
       ORDER BY activity_date DESC
       LIMIT $3 OFFSET $4`,
      [userId, startDateStr, parseInt(limit), parseInt(offset)]
    );

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total
       FROM user_daily_activities 
       WHERE user_id = $1 AND activity_date >= $2`,
      [userId, startDateStr]
    );

    const totalCount = parseInt(countResult.rows[0].total);

    console.log('✅ Activity history retrieved successfully:', {
      userId: userId,
      period: period,
      recordCount: historyResult.rows.length,
      totalCount: totalCount,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        activities: historyResult.rows.map(row => ({
          date: row.activity_date,
          versesRead: row.verses_read,
          prayersSaid: row.prayers_said,
          reflectionsCompleted: row.reflections_completed,
          studyHours: parseFloat(row.study_hours),
          notesCreated: row.notes_created
        })),
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
        },
        period: daysBack
      }
    });

  } catch (error) {
    console.error('❌ Get activity history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve activity history',
      message: error.message
    });
  }
});

// Get Streak Information
router.get('/daily-activity/streak', authenticateToken, async (req, res) => {
  console.log('🔥 Get Streak Information Request:', {
    userId: req.user.id,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;

    // Get current streak
    const currentStreakResult = await pool.query(
      `WITH daily_activities AS (
         SELECT activity_date
         FROM user_daily_activities 
         WHERE user_id = $1
         ORDER BY activity_date DESC
       ),
       streaks AS (
         SELECT activity_date,
                ROW_NUMBER() OVER (ORDER BY activity_date DESC) - 
                ROW_NUMBER() OVER (PARTITION BY activity_date - (ROW_NUMBER() OVER (ORDER BY activity_date DESC) * INTERVAL '1 day') ORDER BY activity_date DESC) as streak_group
         FROM daily_activities
       )
       SELECT COUNT(*) as current_streak
       FROM streaks 
       WHERE streak_group = 0`,
      [userId]
    );

    // Get longest streak
    const longestStreakResult = await pool.query(
      `WITH daily_activities AS (
         SELECT activity_date
         FROM user_daily_activities 
         WHERE user_id = $1
         ORDER BY activity_date DESC
       ),
       streaks AS (
         SELECT activity_date,
                ROW_NUMBER() OVER (ORDER BY activity_date DESC) - 
                ROW_NUMBER() OVER (PARTITION BY activity_date - (ROW_NUMBER() OVER (ORDER BY activity_date DESC) * INTERVAL '1 day') ORDER BY activity_date DESC) as streak_group
         FROM daily_activities
       ),
       streak_lengths AS (
         SELECT streak_group, COUNT(*) as length
         FROM streaks
         GROUP BY streak_group
       )
       SELECT MAX(length) as longest_streak
       FROM streak_lengths`,
      [userId]
    );

    // Get streak start date
    const streakStartResult = await pool.query(
      `SELECT MIN(activity_date) as streak_start
       FROM user_daily_activities 
       WHERE user_id = $1`,
      [userId]
    );

    // Get last activity date
    const lastActivityResult = await pool.query(
      `SELECT MAX(activity_date) as last_activity
       FROM user_daily_activities 
       WHERE user_id = $1`,
      [userId]
    );

    console.log('✅ Streak information retrieved successfully:', {
      userId: userId,
      currentStreak: currentStreakResult.rows[0].current_streak,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        currentStreak: parseInt(currentStreakResult.rows[0].current_streak) || 0,
        longestStreak: parseInt(longestStreakResult.rows[0].longest_streak) || 0,
        streakStart: streakStartResult.rows[0].streak_start,
        lastActivity: lastActivityResult.rows[0].last_activity
      }
    });

  } catch (error) {
    console.error('❌ Get streak information error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve streak information',
      message: error.message
    });
  }
});

// Get Study Hours Tracking
router.get('/daily-activity/study-hours', authenticateToken, async (req, res) => {
  console.log('⏰ Get Study Hours Tracking Request:', {
    userId: req.user.id,
    query: req.query,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;
    const { period = '30' } = req.query; // days

    const daysBack = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get study hours data
    const studyHoursResult = await pool.query(
      `SELECT activity_date, study_hours
       FROM user_daily_activities 
       WHERE user_id = $1 AND activity_date >= $2 AND study_hours > 0
       ORDER BY activity_date DESC`,
      [userId, startDateStr]
    );

    // Calculate total study hours
    const totalStudyHours = studyHoursResult.rows.reduce((sum, row) => sum + parseFloat(row.study_hours), 0);

    // Calculate average study hours per day
    const avgStudyHours = studyHoursResult.rows.length > 0 ? totalStudyHours / studyHoursResult.rows.length : 0;

    // Get study hours by day of week
    const studyByDayResult = await pool.query(
      `SELECT 
         EXTRACT(DOW FROM activity_date) as day_of_week,
         AVG(study_hours) as avg_hours,
         COUNT(*) as days_count
       FROM user_daily_activities 
       WHERE user_id = $1 AND activity_date >= $2 AND study_hours > 0
       GROUP BY EXTRACT(DOW FROM activity_date)
       ORDER BY day_of_week`,
      [userId, startDateStr]
    );

    console.log('✅ Study hours tracking retrieved successfully:', {
      userId: userId,
      period: period,
      totalHours: totalStudyHours,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        period: daysBack,
        totalStudyHours: parseFloat(totalStudyHours.toFixed(2)),
        averageStudyHours: parseFloat(avgStudyHours.toFixed(2)),
        studyDays: studyHoursResult.rows.length,
        dailyData: studyHoursResult.rows.map(row => ({
          date: row.activity_date,
          hours: parseFloat(row.study_hours)
        })),
        byDayOfWeek: studyByDayResult.rows.map(row => ({
          dayOfWeek: parseInt(row.day_of_week),
          dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parseInt(row.day_of_week)],
          averageHours: parseFloat(row.avg_hours),
          daysCount: parseInt(row.days_count)
        }))
      }
    });

  } catch (error) {
    console.error('❌ Get study hours tracking error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve study hours tracking',
      message: error.message
    });
  }
});

module.exports = router;
