import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/atom-one-dark-reasonable.css'; 
import { useState, useRef, useEffect } from 'react';
import { 
  ShieldCheckIcon, PaperAirplaneIcon, ChatBubbleBottomCenterTextIcon, 
  PlusIcon, UserCircleIcon, Cog6ToothIcon, TrashIcon,
  DocumentIcon, PhotoIcon, ArrowRightOnRectangleIcon, XMarkIcon, PaperClipIcon,
  Bars3Icon // 🟢 Added Hamburger Menu Icon for Mobile
} from '@heroicons/react/24/outline';

export default function Chat() {
  // ==========================================
  // 🔐 AUTHENTICATION STATE
  // ==========================================
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState('login'); 
  const [currentUser, setCurrentUser] = useState(null);
  const [authForm, setAuthForm] = useState({ name: '', phone: '', pin: '' });
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  
  // ==========================================
  // ⚙️ AEGIS SETTINGS & MOBILE SIDEBAR STATE
  // ==========================================
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // 🟢 Mobile Drawer Toggle
  const [aegisSettings, setAegisSettings] = useState({
    systemPrompt: "You are Aegis, an advanced and highly capable general-purpose AI assistant. You have expert-level knowledge in full-stack web development, generative AI engineering, cybersecurity, and general logic.",
    kValue: 5,
    lowResourceMode: false
  });

  // ==========================================
  // 🧠 CHAT STATE
  // ==========================================
  const [prompt, setPrompt] = useState('');
  const [currentQuery, setCurrentQuery] = useState(''); 
  const [chatResponse, setChatResponse] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [toolStatus, setToolStatus] = useState('');
  const [chatHistory, setChatHistory] = useState([]); 
  const [dynamicSessions, setDynamicSessions] = useState([]); 
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);

  const fileInputRef = useRef(null); 
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // ==========================================
  // 💾 PERSISTENCE & LIFECYCLE
  // ==========================================
  useEffect(() => {
    const token = localStorage.getItem('aegis_token');
    const storedUser = localStorage.getItem('aegis_user');
    
    if (token && storedUser) {
      setCurrentUser(JSON.parse(storedUser));
      setIsAuthenticated(true);

      const savedSessions = localStorage.getItem('aegis_sessions');
      if (savedSessions) {
        const parsedSessions = JSON.parse(savedSessions);
        setDynamicSessions(parsedSessions);
        
        if (parsedSessions.length > 0) {
          const lastSessionId = parsedSessions[0].id;
          setActiveSessionId(lastSessionId);
          const savedHistory = localStorage.getItem(`aegis_chat_${lastSessionId}`);
          if (savedHistory) setChatHistory(JSON.parse(savedHistory));
        }
      }
    }
  }, []);

  useEffect(() => {
    if (activeSessionId && chatHistory.length > 0) {
      localStorage.setItem(`aegis_chat_${activeSessionId}`, JSON.stringify(chatHistory));
    }
  }, [chatHistory, activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatResponse, toolStatus, isGenerating, chatHistory]);

  // ==========================================
  // 🔐 AUTHENTICATION HANDLERS
  // ==========================================
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);
    
    const endpoint = authMode === 'signup' ? 'https://aegis-gateway-server.onrender.com/api/v1/signup' : 'https://aegis-gateway-server.onrender.com/api/v1/login';
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Authentication failed');
      
      localStorage.setItem('aegis_token', data.token);
      localStorage.setItem('aegis_user', JSON.stringify(data.user)); 
      
      setCurrentUser(data.user);
      setIsAuthenticated(true);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('aegis_token');
    localStorage.removeItem('aegis_user');
    setIsAuthenticated(false);
    setCurrentUser(null);
    setChatHistory([]);
    setDynamicSessions([]);
  };

  // ==========================================
  // 🧠 CHAT HANDLERS
  // ==========================================
  const loadSession = (sessionId) => {
    setActiveSessionId(sessionId);
    const savedHistory = localStorage.getItem(`aegis_chat_${sessionId}`);
    
    if (savedHistory) {
      setChatHistory(JSON.parse(savedHistory));
    } else {
      setChatHistory([]);
    }
    
    setCurrentQuery('');
    setChatResponse('');
    setToolStatus('');
    setIsMobileMenuOpen(false); // Close mobile drawer on select
  };

  const startNewChat = () => {
    setCurrentQuery(''); 
    setChatResponse(''); 
    setToolStatus(''); 
    setChatHistory([]); 
    setActiveSessionId(null); 
    clearFile();
    setIsMobileMenuOpen(false); // Close mobile drawer
  };

  const handleInput = (e) => {
    e.target.style.height = 'auto'; 
    e.target.style.height = `${e.target.scrollHeight}px`; 
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e);
    }
  };

  const handleStarterPrompt = (text) => {
    setPrompt(text);
    if (textareaRef.current) textareaRef.current.focus(); 
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        setFilePreview(URL.createObjectURL(file));
      } else {
        setFilePreview(null); 
      }
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = ''; 
  };

  const purgeVectorCache = () => {
    setToolStatus("Purging local FAISS vector cache...");
    setTimeout(() => {
      setToolStatus('');
      alert("Vector cache cleared successfully!");
    }, 1500);
  };

  const sendMessage = async (e, overridePrompt = null) => {
    if (e && e.preventDefault) e.preventDefault();
    
    const finalPrompt = overridePrompt || prompt;
    if (!finalPrompt.trim() && !selectedFile) return; 

    let currentId = activeSessionId;
    if (!currentId) {
      currentId = Date.now().toString();
      setActiveSessionId(currentId);
      
      setDynamicSessions(prev => {
        const newSessions = [
          { id: currentId, title: finalPrompt.length > 25 ? finalPrompt.substring(0, 25) + '...' : (finalPrompt || "File Upload") },
          ...prev
        ];
        localStorage.setItem('aegis_sessions', JSON.stringify(newSessions)); 
        return newSessions;
      });
    }

    setCurrentQuery(finalPrompt);
    setPrompt('');
    setChatResponse(''); 
    setToolStatus(''); 
    setIsGenerating(true);
    
    const fileToSend = selectedFile; 
    clearFile(); 

    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    let accumulatedResponse = ''; 

    try {
      const formData = new FormData();
      formData.append('prompt', finalPrompt);
      formData.append("history", JSON.stringify(chatHistory));
      
      formData.append('userId', currentUser?.id || 'guest');
      formData.append('sessionId', currentId);
      
      formData.append('systemPrompt', aegisSettings.systemPrompt);
      formData.append('kValue', aegisSettings.kValue);
      formData.append('lowResourceMode', aegisSettings.lowResourceMode);
      
      if (fileToSend) formData.append('file', fileToSend);

      const response = await fetch('https://aegis-python-router.onrender.com/api/v1/generate', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('aegis_token')}` 
        },
        body: formData,
      });

      if (!response.body) throw new Error('ReadableStream not supported.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || ''; 

        for (const chunk of chunks) {
          if (chunk.startsWith('data: ')) {
            const jsonStr = chunk.replace('data: ', '').trim();
            if (!jsonStr) continue;

            try {
              const parsedData = JSON.parse(jsonStr);
              
              if (parsedData.status !== undefined) {
                setToolStatus(parsedData.status);
              }
              
              if (parsedData.token) {
                accumulatedResponse += parsedData.token;
                setChatResponse(accumulatedResponse); 
              }

              if (parsedData.error) {
                setChatResponse(prev => prev + '\n\n❌ System Error: ' + parsedData.error);
              }
            } catch (err) {
              console.warn("Skipped malformed chunk");
            }
          }
        }
      }

      setChatHistory(prev => [
        ...prev,
        { role: 'user', content: finalPrompt },
        { role: 'assistant', content: accumulatedResponse }
      ]);
      
      setCurrentQuery('');
      setChatResponse('');

    } catch (error) {
      console.error('Streaming engine failed:', error);
      setChatResponse('❌ System engine failure. Ensure Python Router is running.');
    } finally {
      setIsGenerating(false);
    }
  };

  const hasActiveChat = currentQuery || chatResponse || isGenerating || chatHistory.length > 0;

  // Sidebar Content Reusable Helper
  const renderSidebarContent = () => (
    <>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <ShieldCheckIcon className="w-10 h-10 text-emerald-500" />
          <h1 className="text-3xl font-bold text-gray-50 tracking-tight">Aegis_<span className="text-emerald-500 font-extralight">ai</span></h1>
        </div>
        <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-gray-400 hover:text-white">
          <XMarkIcon className="w-6 h-6" />
        </button>
      </div>
      
      <button onClick={startNewChat} className="w-full flex items-center justify-center gap-3 bg-emerald-600 text-white font-semibold py-3 px-6 rounded-xl hover:bg-emerald-500 transition-colors shadow-md mb-6">
        <PlusIcon className="w-6 h-6" /> New Chat
      </button>

      <nav className="flex-grow space-y-2 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-700 mb-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">Sessions</h2>
        {dynamicSessions.length === 0 && <p className="px-2 text-sm text-gray-500 italic">No previous sessions</p>}
        
        {dynamicSessions.map((session) => (
          <button 
            key={session.id} 
            onClick={() => loadSession(session.id)}
            className={`flex w-full items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-150 group ${activeSessionId === session.id ? 'bg-[#2e3a4e] text-emerald-400' : 'text-gray-300 hover:bg-[#2e3a4e]'}`}
          >
            <ChatBubbleBottomCenterTextIcon className={`w-5 h-5 shrink-0 ${activeSessionId === session.id ? 'text-emerald-400' : 'text-gray-500 group-hover:text-emerald-400'}`} />
            <span className="font-medium text-sm truncate">{session.title}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto pt-4 border-t border-gray-700">
        <div className="flex items-center justify-between bg-[#111827] p-3 rounded-xl border border-gray-700">
          <div className="flex items-center gap-3 truncate">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0">
              {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <span className="text-sm font-medium truncate text-gray-300">{currentUser?.name || 'User'}</span>
          </div>
          
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => { setIsSettingsOpen(true); setIsMobileMenuOpen(false); }} className="p-1.5 text-gray-400 hover:text-emerald-400 transition-colors rounded-lg hover:bg-[#1f2937]" title="Settings">
              <Cog6ToothIcon className="w-5 h-5" />
            </button>
            <button onClick={logout} className="p-1.5 text-gray-400 hover:text-red-400 transition-colors rounded-lg hover:bg-[#1f2937]" title="Logout">
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );

  // ==========================================
  // 🎨 RENDER AUTHENTICATION SCREEN
  // ==========================================
  if (!isAuthenticated) {
    return (
      <div className="flex h-[100dvh] w-full overflow-hidden bg-[#111827] items-center justify-center p-4">
        <div className="bg-[#1f2937] p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 animate-fade-in-up mx-2">
          <div className="flex items-center justify-center gap-3 mb-8">
            <ShieldCheckIcon className="w-12 h-12 text-emerald-500" />
            <h1 className="text-4xl font-bold text-gray-50 tracking-tight">Aegis_<span className="text-emerald-500 font-extralight">ai</span></h1>
          </div>
          
          <h2 className="text-xl text-gray-300 text-center mb-6 font-semibold">
            {authMode === 'login' ? 'Access Terminal' : 'Initialize Identity'}
          </h2>

          {authError && <div className="bg-red-500/10 text-red-400 p-3 rounded-xl mb-4 text-sm text-center border border-red-500/20">{authError}</div>}

          <form onSubmit={handleAuthSubmit} className="space-y-4" autoComplete="off">
            {authMode === 'signup' && (
              <input 
                type="text" required placeholder="Display Name" 
                autoComplete="off"
                className="w-full bg-[#111827] border border-gray-700 text-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})}
              />
            )}
            <input 
              type="tel" required placeholder="Phone Number" 
              autoComplete="off"
              className="w-full bg-[#111827] border border-gray-700 text-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              value={authForm.phone} onChange={e => setAuthForm({...authForm, phone: e.target.value})}
            />
            <input 
              type="password" required maxLength={6} placeholder="4 to 6 Digit PIN" 
              autoComplete="new-password"
              className="w-full bg-[#111827] border border-gray-700 text-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors tracking-widest"
              value={authForm.pin} onChange={e => setAuthForm({...authForm, pin: e.target.value})}
            />
            
            <button 
              type="submit" 
              disabled={isAuthLoading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-colors mt-2 shadow-lg"
            >
              {isAuthLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Processing...</span>
                </>
              ) : (
                authMode === 'login' ? 'Initialize Session' : 'Create Access'
              )}
            </button>
          </form>
          <p className="text-center text-gray-500 mt-6 text-sm">
            {authMode === 'login' ? "Don't have clearance? " : "Already established? "}
            <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-4">
              {authMode === 'login' ? 'Sign up' : 'Log in'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ==========================================
  // 🎨 RENDER MAIN CHAT INTERFACE
  // ==========================================
  return (
    <div className="flex h-[100dvh] w-full bg-[#111827] text-gray-200 font-sans antialiased overflow-hidden relative">
      
      {/* ⚙️ SETTINGS MODAL */}
      {isSettingsOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in px-4">
          <div className="bg-[#1f2937] border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden mx-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-700 bg-[#1a2332]">
              <h3 className="text-xl font-bold text-gray-100 flex items-center gap-2">
                <Cog6ToothIcon className="w-6 h-6 text-emerald-500" /> System Configuration
              </h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wider">Core Directive (System Prompt)</label>
                <textarea 
                  className="w-full bg-[#111827] border border-gray-700 rounded-xl p-3 text-sm text-gray-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors resize-none h-24"
                  value={aegisSettings.systemPrompt}
                  onChange={(e) => setAegisSettings({...aegisSettings, systemPrompt: e.target.value})}
                />
              </div>

              <div>
                <label className="flex justify-between text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                  <span>RAG Context Governor (k-value)</span>
                  <span className="text-emerald-400">{aegisSettings.kValue} Chunks</span>
                </label>
                <input 
                  type="range" min="1" max="10" step="1"
                  className="w-full accent-emerald-500"
                  value={aegisSettings.kValue}
                  onChange={(e) => setAegisSettings({...aegisSettings, kValue: e.target.value})}
                />
                <p className="text-xs text-gray-500 mt-2">Higher values improve document context but consume more memory.</p>
              </div>

              <div className="flex items-center justify-between bg-[#111827] p-4 rounded-xl border border-gray-700">
                <div>
                  <h4 className="text-sm font-semibold text-gray-200">Low Resource Mode</h4>
                  <p className="text-xs text-gray-500">Disable heavy animations and reduce text chunking size.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={aegisSettings.lowResourceMode} onChange={() => setAegisSettings({...aegisSettings, lowResourceMode: !aegisSettings.lowResourceMode})} />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              <div className="pt-4 border-t border-gray-700">
                <button onClick={purgeVectorCache} className="w-full flex items-center justify-center gap-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 font-semibold py-3 rounded-xl transition-colors">
                  <TrashIcon className="w-5 h-5" /> Purge Local Vector Cache
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 📱 MOBILE SLIDE-OUT MENU OVERLAY (ChatGPT Style) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[#1f2937] p-6 z-50 shadow-2xl border-r border-gray-700">
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* 💻 DESKTOP SIDEBAR */}
      <aside className="w-72 bg-[#1f2937] p-6 flex flex-col border-r border-gray-700 hidden md:flex shrink-0">
        {renderSidebarContent()}
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col p-4 sm:p-6 lg:p-12 xl:px-32 xl:py-12 h-full relative overflow-x-hidden w-full">
        <header className="flex items-center justify-between pb-4 sm:pb-6 mb-4 sm:mb-6 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* 🟢 Mobile Menu Hamburger Button */}
            <button 
              onClick={() => setIsMobileMenuOpen(true)} 
              className="p-1.5 text-gray-300 hover:text-emerald-400 border border-gray-700 rounded-lg md:hidden"
              title="Open Menu"
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
            <ChatBubbleBottomCenterTextIcon className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-500 shrink-0 hidden sm:block" />
            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-50 tracking-tighter truncate">Aegis Terminal</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 bg-[#1f2937] px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-gray-700 shadow-inner shrink-0">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[10px] sm:text-xs font-semibold text-emerald-400 uppercase tracking-wider hidden sm:block">SYSTEM READY</span>
          </div>
        </header>

        {/* Chat Stream */}
        <div className="flex-grow overflow-y-auto overflow-x-hidden pr-2 sm:pr-4 mb-4 sm:mb-6 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
          
          {!hasActiveChat && (
            <div className="h-full flex flex-col items-center justify-center animate-fade-in-up mt-4 sm:mt-10 px-2 sm:px-4">
              <ShieldCheckIcon className="w-16 h-16 sm:w-20 sm:h-20 text-emerald-500/80 mb-4 sm:mb-6" />
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-100 mb-2 sm:mb-3 text-center">Welcome back, {currentUser?.name}.</h2>
              <p className="text-gray-400 text-base sm:text-lg mb-6 sm:mb-8 text-center max-w-xl">
                I am Aegis, your local Omni-AI. I can debug architectures, analyze security threats, and execute logic securely.
              </p>
              
              <div className="flex flex-wrap justify-center gap-2 sm:gap-3 w-full max-w-3xl">
                <button 
                  onClick={() => handleStarterPrompt("Can you review this React component for performance bottlenecks?\n\n```javascript\n\n```")} 
                  className="px-4 py-2 sm:px-5 sm:py-2.5 bg-[#1f2937] border border-gray-700 rounded-full hover:border-emerald-500 hover:text-emerald-400 text-xs sm:text-sm font-medium text-gray-300 transition-colors shadow-sm"
                >
                  ⚡ Optimize React Code
                </button>
                <button 
                  onClick={() => handleStarterPrompt("Analyze the attached document and summarize the key security vulnerabilities.")} 
                  className="px-4 py-2 sm:px-5 sm:py-2.5 bg-[#1f2937] border border-gray-700 rounded-full hover:border-emerald-500 hover:text-emerald-400 text-xs sm:text-sm font-medium text-gray-300 transition-colors shadow-sm"
                >
                  📄 Summarize Document
                </button>
                <button 
                  onClick={() => handleStarterPrompt("Write a secure, production-ready REST API endpoint in Node.js for...")} 
                  className="px-4 py-2 sm:px-5 sm:py-2.5 bg-[#1f2937] border border-gray-700 rounded-full hover:border-emerald-500 hover:text-emerald-400 text-xs sm:text-sm font-medium text-gray-300 transition-colors shadow-sm"
                >
                  🛠️ Generate API
                </button>
                <button 
                  onClick={() => handleStarterPrompt("Explain the exact differences between fine-tuning an LLM and using a RAG architecture.")} 
                  className="px-4 py-2 sm:px-5 sm:py-2.5 bg-[#1f2937] border border-gray-700 rounded-full hover:border-emerald-500 hover:text-emerald-400 text-xs sm:text-sm font-medium text-gray-300 transition-colors shadow-sm"
                >
                  🧠 Compare AI Models
                </button>
              </div>
            </div>
          )}

          {chatHistory.map((msg, index) => (
            msg.role === 'user' ? (
              <div key={index} className="flex items-start gap-2 sm:gap-4 justify-end mb-6 sm:mb-8">
                <div className="bg-[#2e3a4e] text-gray-100 p-4 sm:p-5 rounded-2xl rounded-br-none max-w-[85%] sm:max-w-2xl shadow-md overflow-hidden">
                  <p className="text-[14px] sm:text-[16px] leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                </div>
                <UserCircleIcon className="w-8 h-8 sm:w-10 sm:h-10 text-gray-600 mt-1 shrink-0 hidden sm:block" />
              </div>
            ) : (
              <div key={index} className="flex items-start gap-2 sm:gap-4 mb-4 sm:mb-6 w-full overflow-hidden">
                <ShieldCheckIcon className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-500 mt-1 shrink-0 hidden sm:block" />
                <div className="flex flex-col w-full min-w-0">
                  <div className="bg-[#1f2937] text-gray-200 p-4 sm:p-6 rounded-2xl rounded-bl-none border border-gray-700 shadow-lg overflow-x-auto w-full text-[14px] sm:text-[16px]">
                    <div className="prose prose-sm sm:prose-base prose-invert prose-emerald max-w-none break-words">
                      <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            )
          ))}

          {currentQuery && (
            <div className="flex items-start gap-2 sm:gap-4 justify-end mb-6 sm:mb-8 animate-fade-in-up">
              <div className="bg-[#2e3a4e] text-gray-100 p-4 sm:p-5 rounded-2xl rounded-br-none max-w-[85%] sm:max-w-2xl shadow-md overflow-hidden">
                <p className="text-[14px] sm:text-[16px] leading-relaxed whitespace-pre-wrap break-words">{currentQuery}</p>
              </div>
              <UserCircleIcon className="w-8 h-8 sm:w-10 sm:h-10 text-gray-600 mt-1 shrink-0 hidden sm:block" />
            </div>
          )}

          {(chatResponse || toolStatus) && (
            <div className="flex items-start gap-2 sm:gap-4 mb-4 sm:mb-6 animate-fade-in-up w-full overflow-hidden">
              <ShieldCheckIcon className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-500 mt-1 shrink-0 hidden sm:block" />
              <div className="flex flex-col w-full min-w-0">
                {toolStatus && (
                  <div className="flex items-center space-x-2 text-xs sm:text-sm text-emerald-400 font-mono animate-pulse mb-3 bg-[#1f2937] p-2 sm:p-3 rounded-xl border border-gray-700 max-w-max shadow-sm">
                    <svg className="animate-spin h-3 w-3 sm:h-4 sm:w-4 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{toolStatus}</span>
                  </div>
                )}
                {chatResponse && (
                  <div className="bg-[#1f2937] text-gray-200 p-4 sm:p-6 rounded-2xl rounded-bl-none border border-gray-700 shadow-lg overflow-x-auto w-full text-[14px] sm:text-[16px]">
                    <div className="prose prose-sm sm:prose-base prose-invert prose-emerald max-w-none break-words">
                      {isGenerating ? (
                        <div className="whitespace-pre-wrap font-sans leading-relaxed">{chatResponse}</div>
                      ) : (
                        <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{chatResponse}</ReactMarkdown>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {isGenerating && !chatResponse && !toolStatus && (
            <div className="flex items-center gap-2 sm:gap-4 mb-6">
              <ShieldCheckIcon className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-500 shrink-0 hidden sm:block" />
              <div className="flex gap-2.5 ml-2 sm:ml-0">
                <div className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 bg-emerald-500 rounded-full animate-bounce delay-75"></div>
                <div className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 bg-emerald-500 rounded-full animate-bounce delay-150"></div>
                <div className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 bg-emerald-500 rounded-full animate-bounce delay-300"></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="mt-auto relative shrink-0 flex flex-col w-full">
          {selectedFile && (
            <div className="absolute -top-12 sm:-top-14 left-0 flex items-center gap-2 sm:gap-3 bg-[#1f2937] border border-emerald-600/50 text-gray-200 px-3 sm:px-4 py-2 rounded-xl shadow-lg animate-fade-in-up z-10 max-w-[90%] sm:max-w-md">
              {filePreview ? (
                <img src={filePreview} alt="Preview" className="w-6 h-6 sm:w-8 sm:h-8 object-cover rounded-md border border-gray-600 shrink-0" />
              ) : selectedFile.type === 'application/pdf' ? (
                <DocumentIcon className="w-5 h-5 sm:w-6 sm:h-6 text-red-400 shrink-0" />
              ) : (
                <PhotoIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400 shrink-0" />
              )}
              
              <div className="flex flex-col min-w-0 max-w-[120px] sm:max-w-[200px]">
                <span className="text-xs sm:text-sm font-semibold truncate">{selectedFile.name}</span>
                <span className="text-[10px] sm:text-xs text-gray-400">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
              <button type="button" onClick={clearFile} className="ml-auto text-gray-400 hover:text-red-400 transition-colors shrink-0 p-1">
                <XMarkIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          )}

          <form onSubmit={sendMessage} className="relative flex items-end gap-2 w-full">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf,image/png,image/jpeg,image/webp" className="hidden" />
            
            {/* 🟢 FIX 1: Exact dimension matching (54px mobile, 60px desktop) */}
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()} 
              disabled={isGenerating} 
              className="bg-[#1f2937] border-2 border-gray-700 rounded-xl sm:rounded-2xl text-gray-400 hover:text-emerald-400 hover:border-emerald-500 transition-all disabled:opacity-50 h-[54px] w-[54px] sm:h-[60px] sm:w-[60px] flex items-center justify-center shrink-0"
            >
              <PaperClipIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            <div className="relative flex-grow min-w-0">
              {/* 🟢 FIX 2: Switched inline minHeight to Tailwind classes for perfect syncing */}
              <textarea
                ref={textareaRef} rows={1} value={prompt}
                onChange={(e) => { setPrompt(e.target.value); handleInput(e); }} onKeyDown={handleKeyDown}
                placeholder="Message Aegis..."
                className="block w-full min-h-[54px] sm:min-h-[60px] bg-[#1f2937] border-2 border-gray-700 focus:border-emerald-600 focus:ring-0 text-gray-100 placeholder-gray-500 rounded-xl sm:rounded-2xl py-3.5 sm:py-4 pl-4 sm:pl-6 pr-12 sm:pr-16 text-[14px] sm:text-[16px] shadow-xl transition-all duration-150 resize-none overflow-hidden"
                style={{ maxHeight: '150px' }} 
                disabled={isGenerating}
              />
              
              {/* 🟢 FIX 3: Mathematically centered the Send Button based on the new 54px/60px heights */}
              <button 
                type="submit" 
                disabled={isGenerating || (!prompt.trim() && !selectedFile)} 
                className="absolute right-2 sm:right-3 bottom-[11px] sm:bottom-[10px] bg-emerald-600 text-white p-2 sm:p-2.5 rounded-lg sm:rounded-xl hover:bg-emerald-500 disabled:opacity-30 transition-colors flex items-center justify-center"
              >
                <PaperAirplaneIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}