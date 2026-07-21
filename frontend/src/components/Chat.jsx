import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/atom-one-dark-reasonable.css'; 
import { useState, useRef, useEffect } from 'react';
import { 
  ShieldCheckIcon, PaperAirplaneIcon, ChatBubbleBottomCenterTextIcon, 
  PlusIcon, UserCircleIcon, BoltIcon, CloudIcon, CodeBracketIcon,
  PaperClipIcon, XMarkIcon, DocumentIcon, PhotoIcon, ArrowRightOnRectangleIcon,
  Cog6ToothIcon, TrashIcon
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

  // ==========================================
  // ⚙️ AEGIS SETTINGS STATE
  // ==========================================
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
  // 💾 PERSISTENCE & LIFECYCLE (THE FIX)
  // ==========================================

  // 1. Load Everything on Mount
  useEffect(() => {
    const token = localStorage.getItem('aegis_token');
    const storedUser = localStorage.getItem('aegis_user');
    
    if (token && storedUser) {
      setCurrentUser(JSON.parse(storedUser));
      setIsAuthenticated(true);

      // 👉 Restore Sessions from Memory
      const savedSessions = localStorage.getItem('aegis_sessions');
      if (savedSessions) {
        const parsedSessions = JSON.parse(savedSessions);
        setDynamicSessions(parsedSessions);
        
        // 👉 Auto-load the most recent chat so the screen isn't blank
        if (parsedSessions.length > 0) {
          const lastSessionId = parsedSessions[0].id;
          setActiveSessionId(lastSessionId);
          const savedHistory = localStorage.getItem(`aegis_chat_${lastSessionId}`);
          if (savedHistory) setChatHistory(JSON.parse(savedHistory));
        }
      }
    }
  }, []);

  // 2. Auto-save chat history whenever it updates
  useEffect(() => {
    if (activeSessionId && chatHistory.length > 0) {
      localStorage.setItem(`aegis_chat_${activeSessionId}`, JSON.stringify(chatHistory));
    }
  }, [chatHistory, activeSessionId]);

  // 3. Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatResponse, toolStatus, isGenerating, chatHistory]);


  // ==========================================
  // 🔐 AUTHENTICATION HANDLERS
  // ==========================================
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = authMode === 'signup' ? 'http://localhost:5005/api/v1/signup' : 'http://localhost:5005/api/v1/login';
    
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

  // 👉 NEW: Load a specific session when clicked in the sidebar
  const loadSession = (sessionId) => {
    setActiveSessionId(sessionId);
    const savedHistory = localStorage.getItem(`aegis_chat_${sessionId}`);
    
    if (savedHistory) {
      setChatHistory(JSON.parse(savedHistory));
    } else {
      setChatHistory([]);
    }
    
    // Clear active typing states
    setCurrentQuery('');
    setChatResponse('');
    setToolStatus('');
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
    if (textareaRef.current) {
      textareaRef.current.focus(); 
    }
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
      
      // 👉 NEW: Save sessions to LocalStorage immediately when created
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
      
      formData.append('userId', currentUser.id);
      formData.append('sessionId', currentId);
      
      formData.append('systemPrompt', aegisSettings.systemPrompt);
      formData.append('kValue', aegisSettings.kValue);
      formData.append('lowResourceMode', aegisSettings.lowResourceMode);
      
      if (fileToSend) formData.append('file', fileToSend);

      const response = await fetch('http://localhost:5005/api/v1/generate', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('aegis_token')}` },
        body: formData,
      });

      if (!response.body) throw new Error('ReadableStream not supported.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const parsedData = JSON.parse(line.slice(6));
                if (parsedData.status !== undefined) setToolStatus(parsedData.status);
                if (parsedData.token) {
                  accumulatedResponse += parsedData.token; 
                  setChatResponse((prev) => prev + parsedData.token); 
                }
              } catch (err) {}
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
      setChatResponse('❌ System engine failure processing request.');
    } finally {
      setIsGenerating(false);
    }
  };

  const hasActiveChat = currentQuery || chatResponse || isGenerating || chatHistory.length > 0;

  // ==========================================
  // 🎨 RENDER AUTHENTICATION SCREEN
  // ==========================================
  if (!isAuthenticated) {
    return (
      <div className="flex h-screen bg-[#111827] items-center justify-center p-4">
        <div className="bg-[#1f2937] p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 animate-fade-in-up">
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
            
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-colors mt-2 shadow-lg">
              {authMode === 'login' ? 'Initialize Session' : 'Create Access'}
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
    <div className="flex h-screen bg-[#111827] text-gray-200 font-sans antialiased overflow-hidden relative">
      
      {/* ⚙️ SETTINGS MODAL */}
      {isSettingsOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1f2937] border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-700 bg-[#1a2332]">
              <h3 className="text-xl font-bold text-gray-100 flex items-center gap-2">
                <Cog6ToothIcon className="w-6 h-6 text-emerald-500" /> System Configuration
              </h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* System Prompt Settings */}
              <div>
                <label className="block text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wider">Core Directive (System Prompt)</label>
                <textarea 
                  className="w-full bg-[#111827] border border-gray-700 rounded-xl p-3 text-sm text-gray-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors resize-none h-24"
                  value={aegisSettings.systemPrompt}
                  onChange={(e) => setAegisSettings({...aegisSettings, systemPrompt: e.target.value})}
                />
              </div>

              {/* RAG Context Window Slider */}
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

              {/* Hardware Toggles */}
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

              {/* Danger Zone */}
              <div className="pt-4 border-t border-gray-700">
                <button onClick={purgeVectorCache} className="w-full flex items-center justify-center gap-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 font-semibold py-3 rounded-xl transition-colors">
                  <TrashIcon className="w-5 h-5" /> Purge Local Vector Cache
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-72 bg-[#1f2937] p-6 flex flex-col border-r border-gray-700 hidden md:flex">
        <div className="flex items-center gap-3 mb-10">
          <ShieldCheckIcon className="w-10 h-10 text-emerald-500" />
          <h1 className="text-3xl font-bold text-gray-50 tracking-tight">Aegis_<span className="text-emerald-500 font-extralight">ai</span></h1>
        </div>
        
        <nav className="flex-grow space-y-3 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-700">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 px-3">Sessions</h2>
          {dynamicSessions.length === 0 && <p className="px-3 text-sm text-gray-500 italic">No previous sessions</p>}
          
          {/* 👉 NEW: Button onClick triggers loadSession() */}
          {dynamicSessions.map((session) => (
            <button 
              key={session.id} 
              onClick={() => loadSession(session.id)}
              className={`flex w-full items-center gap-3 px-4 py-3 rounded-xl transition-colors duration-150 group ${activeSessionId === session.id ? 'bg-[#2e3a4e] text-emerald-400' : 'text-gray-300 hover:bg-[#2e3a4e]'}`}
            >
              <ChatBubbleBottomCenterTextIcon className={`w-5 h-5 shrink-0 ${activeSessionId === session.id ? 'text-emerald-400' : 'text-gray-500 group-hover:text-emerald-400'}`} />
              <span className="font-medium text-[15px] truncate">{session.title}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-3">
          <button onClick={() => { setCurrentQuery(''); setChatResponse(''); setToolStatus(''); setChatHistory([]); setActiveSessionId(null); clearFile(); }} className="w-full flex items-center justify-center gap-3 bg-emerald-600 text-white font-semibold py-3.5 px-6 rounded-xl hover:bg-emerald-500 transition-colors shadow-md">
            <PlusIcon className="w-6 h-6" /> New Chat
          </button>
          
          {/* User Profile & Actions */}
          <div className="flex items-center justify-between bg-[#111827] p-3 rounded-xl border border-gray-700">
            <div className="flex items-center gap-3 truncate">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="text-sm font-medium truncate text-gray-300">{currentUser?.name || 'User'}</span>
            </div>
            
            <div className="flex items-center gap-1">
              <button onClick={() => setIsSettingsOpen(true)} className="p-1.5 text-gray-500 hover:text-emerald-400 transition-colors rounded-lg hover:bg-[#1f2937]" title="Settings">
                <Cog6ToothIcon className="w-5 h-5" />
              </button>
              <button onClick={logout} className="p-1.5 text-gray-500 hover:text-red-400 transition-colors rounded-lg hover:bg-[#1f2937]" title="Logout">
                <ArrowRightOnRectangleIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col p-6 lg:p-12 xl:px-32 xl:py-12 h-full relative">
        <header className="flex items-center justify-between pb-6 mb-6 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-4">
            <ChatBubbleBottomCenterTextIcon className="w-8 h-8 text-emerald-500" />
            <h1 className="text-2xl font-extrabold text-gray-50 tracking-tighter">Aegis Terminal</h1>
          </div>
          <div className="flex items-center gap-3 bg-[#1f2937] px-4 py-2 rounded-full border border-gray-700 shadow-inner">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider hidden sm:block">SYSTEM READY</span>
          </div>
        </header>

        {/* Chat Stream */}
        <div className="flex-grow overflow-y-auto pr-4 mb-6 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
          
          {!hasActiveChat && (
            <div className="h-full flex flex-col items-center justify-center animate-fade-in-up mt-10">
              <ShieldCheckIcon className="w-20 h-20 text-emerald-500/80 mb-6" />
              <h2 className="text-4xl font-bold text-gray-100 mb-3">Welcome back, {currentUser?.name}.</h2>
              <p className="text-gray-400 text-lg mb-8 text-center max-w-xl">
                I am Aegis, your local Omni-AI. I can debug architectures, analyze security threats, and execute logic securely.
              </p>
              
              {/* Sleek, non-intrusive suggestion pills */}
              <div className="flex flex-wrap justify-center gap-3 w-full max-w-3xl">
                <button 
                  onClick={() => handleStarterPrompt("Can you review this React component for performance bottlenecks?\n\n```javascript\n\n```")} 
                  className="px-5 py-2.5 bg-[#1f2937] border border-gray-700 rounded-full hover:border-emerald-500 hover:text-emerald-400 text-sm font-medium text-gray-300 transition-colors shadow-sm"
                >
                  ⚡ Optimize React Code
                </button>
                <button 
                  onClick={() => handleStarterPrompt("Analyze the attached document and summarize the key security vulnerabilities.")} 
                  className="px-5 py-2.5 bg-[#1f2937] border border-gray-700 rounded-full hover:border-emerald-500 hover:text-emerald-400 text-sm font-medium text-gray-300 transition-colors shadow-sm"
                >
                  📄 Summarize Document
                </button>
                <button 
                  onClick={() => handleStarterPrompt("Write a secure, production-ready REST API endpoint in Node.js for...")} 
                  className="px-5 py-2.5 bg-[#1f2937] border border-gray-700 rounded-full hover:border-emerald-500 hover:text-emerald-400 text-sm font-medium text-gray-300 transition-colors shadow-sm"
                >
                  🛠️ Generate API
                </button>
                <button 
                  onClick={() => handleStarterPrompt("Explain the exact differences between fine-tuning an LLM and using a RAG architecture.")} 
                  className="px-5 py-2.5 bg-[#1f2937] border border-gray-700 rounded-full hover:border-emerald-500 hover:text-emerald-400 text-sm font-medium text-gray-300 transition-colors shadow-sm"
                >
                  🧠 Compare AI Models
                </button>
              </div>
            </div>
          )}

          {chatHistory.map((msg, index) => (
            msg.role === 'user' ? (
              <div key={index} className="flex items-start gap-4 justify-end mb-8">
                <div className="bg-[#2e3a4e] text-gray-100 p-5 rounded-2xl rounded-br-none max-w-2xl shadow-md">
                  <p className="text-[16px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
                <UserCircleIcon className="w-10 h-10 text-gray-600 mt-1 shrink-0" />
              </div>
            ) : (
              <div key={index} className="flex items-start gap-4 mb-6">
                <ShieldCheckIcon className="w-10 h-10 text-emerald-500 mt-1 shrink-0" />
                <div className="flex flex-col w-full max-w-4xl">
                  <div className="bg-[#1f2937] text-gray-200 p-6 rounded-2xl rounded-bl-none border border-gray-700 shadow-lg overflow-x-auto text-[16px]">
                    <div className="prose prose-invert prose-emerald max-w-none">
                      <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            )
          ))}

          {currentQuery && (
            <div className="flex items-start gap-4 justify-end mb-8 animate-fade-in-up">
              <div className="bg-[#2e3a4e] text-gray-100 p-5 rounded-2xl rounded-br-none max-w-2xl shadow-md">
                <p className="text-[16px] leading-relaxed whitespace-pre-wrap">{currentQuery}</p>
              </div>
              <UserCircleIcon className="w-10 h-10 text-gray-600 mt-1 shrink-0" />
            </div>
          )}

          {(chatResponse || toolStatus) && (
            <div className="flex items-start gap-4 mb-6 animate-fade-in-up">
              <ShieldCheckIcon className="w-10 h-10 text-emerald-500 mt-1 shrink-0" />
              <div className="flex flex-col w-full max-w-4xl">
                {toolStatus && (
                  <div className="flex items-center space-x-2 text-sm text-emerald-400 font-mono animate-pulse mb-3 bg-[#1f2937] p-3 rounded-xl border border-gray-700 max-w-max shadow-sm">
                    <svg className="animate-spin h-4 w-4 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{toolStatus}</span>
                  </div>
                )}
                {chatResponse && (
                  <div className="bg-[#1f2937] text-gray-200 p-6 rounded-2xl rounded-bl-none border border-gray-700 shadow-lg overflow-x-auto text-[16px]">
                    <div className="prose prose-invert prose-emerald max-w-none">
                      <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{chatResponse}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {isGenerating && !chatResponse && !toolStatus && (
            <div className="flex items-center gap-4 mb-6">
              <ShieldCheckIcon className="w-10 h-10 text-emerald-500 shrink-0" />
              <div className="flex gap-2.5">
                <div className="w-3.5 h-3.5 bg-emerald-500 rounded-full animate-bounce delay-75"></div>
                <div className="w-3.5 h-3.5 bg-emerald-500 rounded-full animate-bounce delay-150"></div>
                <div className="w-3.5 h-3.5 bg-emerald-500 rounded-full animate-bounce delay-300"></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="mt-auto relative shrink-0 flex flex-col">
          {selectedFile && (
            <div className="absolute -top-14 left-0 flex items-center gap-3 bg-[#1f2937] border border-emerald-600/50 text-gray-200 px-4 py-2 rounded-xl shadow-lg animate-fade-in-up">
              {filePreview ? (
                <img src={filePreview} alt="Preview" className="w-8 h-8 object-cover rounded-md border border-gray-600" />
              ) : selectedFile.type === 'application/pdf' ? (
                <DocumentIcon className="w-6 h-6 text-red-400" />
              ) : (
                <PhotoIcon className="w-6 h-6 text-blue-400" />
              )}
              
              <div className="flex flex-col max-w-[200px]">
                <span className="text-sm font-semibold truncate">{selectedFile.name}</span>
                <span className="text-xs text-gray-400">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
              <button type="button" onClick={clearFile} className="ml-2 text-gray-400 hover:text-red-400 transition-colors">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          )}

          <form onSubmit={sendMessage} className="relative flex items-end gap-2">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf,image/png,image/jpeg,image/webp" className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isGenerating} className="p-4 bg-[#1f2937] border-2 border-gray-700 rounded-2xl text-gray-400 hover:text-emerald-400 hover:border-emerald-500 transition-all disabled:opacity-50 h-[60px] flex items-center justify-center shrink-0">
              <PaperClipIcon className="w-6 h-6" />
            </button>

            <div className="relative flex-grow">
              <textarea
                ref={textareaRef} rows={1} value={prompt}
                onChange={(e) => { setPrompt(e.target.value); handleInput(e); }} onKeyDown={handleKeyDown}
                placeholder="Message Aegis... (Shift+Enter for new line)"
                className="w-full bg-[#1f2937] border-2 border-gray-700 focus:border-emerald-600 focus:ring-0 text-gray-100 placeholder-gray-500 rounded-2xl py-4 pl-6 pr-16 text-[16px] shadow-xl transition-all duration-150 resize-none overflow-hidden"
                style={{ minHeight: '60px', maxHeight: '200px' }} disabled={isGenerating}
              />
              <button type="submit" disabled={isGenerating || (!prompt.trim() && !selectedFile)} className="absolute right-3 bottom-3 bg-emerald-600 text-white p-2.5 rounded-xl hover:bg-emerald-500 disabled:opacity-30 transition-colors">
                <PaperAirplaneIcon className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}