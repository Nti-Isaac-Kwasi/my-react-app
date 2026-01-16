import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  LayoutGrid, Bell, Users, Archive, Video, TrendingUp, 
  Briefcase, PenTool, User, Settings, Menu, X, 
  Sparkles, PlayCircle, Award, CheckCircle, Circle, 
  Flame, Download, FolderDown, MessageCircle, Send,
  Loader, ArrowRight, Search, AlertTriangle
} from 'lucide-react';
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  updateDoc, 
  increment, 
  arrayUnion, 
  serverTimestamp 
} from "firebase/firestore";

// --- FIREBASE CONFIGURATION & SAFETY CHECKS ---
let app, auth, db, firebaseError = null;

try {
  // 1. Try to get config from the AI Environment Global
  let configStr = typeof __firebase_config !== 'undefined' ? __firebase_config : null;
  
  // 2. Fallback: Check for standard Vite Env Vars (for Vercel/Netlify)
  if (!configStr && import.meta && import.meta.env && import.meta.env.VITE_FIREBASE_CONFIG) {
    configStr = import.meta.env.VITE_FIREBASE_CONFIG;
  }

  const firebaseConfig = configStr ? JSON.parse(configStr) : {};

  // 3. Validate Config
  if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
    throw new Error("Missing Firebase Configuration");
  }

  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

} catch (e) {
  console.error("Firebase Initialization Error:", e);
  firebaseError = e.message;
}

// Sanitized App ID
const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'gip-pro-default';
const appId = rawAppId.replace(/\//g, '_');

// --- MAIN APP COMPONENT ---
export default function App() {
  // If config is missing, show a friendly setup screen instead of crashing
  if (firebaseError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans text-gray-800">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-red-100">
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} />
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">Setup Required</h1>
          <p className="text-gray-500 text-center mb-6">
            The app loads successfully, but it's missing the connection to Firebase.
          </p>
          <div className="bg-gray-100 p-4 rounded-lg text-sm mb-6">
            <strong>Diagnostic:</strong> {firebaseError === "Missing Firebase Configuration" 
              ? "No API keys found. If deploying to Vercel/Netlify, add your Firebase Config JSON as an environment variable."
              : firebaseError}
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // State
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState({
    displayName: 'Student',
    xp: 0,
    streak: 1,
    badges: [],
    completedModules: [],
    certificates: [],
    visitCounts: { forex: 0, sales: 0, design: 0 },
    searchHistory: [],
    settings: { darkMode: false }
  });
  
  // Navigation & UI State
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [themeColor, setThemeColor] = useState('#3b82f6');
  const [chatOpen, setChatOpen] = useState(false);
  
  // Data Cache
  const [courses, setCourses] = useState({ forex: [], sales: [], design: [] });
  const [posts, setPosts] = useState([]);
  const [videos, setVideos] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [currentModule, setCurrentModule] = useState(null);

  // --- AUTH & INIT ---
  useEffect(() => {
    if (!auth) return;

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("Auth Error:", e);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        try {
          if (!db) return;
          const userRef = doc(db, 'artifacts', appId, 'users', u.uid);
          await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true });
        } catch (err) {
          console.error("Error creating user doc:", err);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // --- DATA LISTENERS ---
  useEffect(() => {
    if (!user || !db) return;

    // 1. User Profile Listener
    const unsubUser = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData(prev => ({ ...prev, ...data }));
        if (data.settings?.darkMode) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    }, (error) => console.log("User listener error:", error));

    // 2. Courses Listener
    const unsubCourses = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'course_modules'), (snapshot) => {
      const newCourses = { forex: [], sales: [], design: [] };
      snapshot.forEach(doc => {
        const d = { id: doc.id, ...doc.data() };
        if (newCourses[d.courseId]) newCourses[d.courseId].push(d);
      });
      // Sort
      Object.keys(newCourses).forEach(k => {
        newCourses[k].sort((a, b) => (a.order || 0) - (b.order || 0));
      });
      setCourses(newCourses);
    }, (error) => console.log("Courses listener error:", error));

    // 3. Posts
    const unsubPosts = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'community_posts'), (snapshot) => {
      const p = [];
      snapshot.forEach(doc => p.push({ id: doc.id, ...doc.data() }));
      p.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setPosts(p);
    }, (error) => console.log("Posts listener error:", error));

    // 4. Video Library
    const unsubVideos = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'video_library'), (snapshot) => {
      const v = [];
      snapshot.forEach(doc => v.push({ id: doc.id, ...doc.data() }));
      setVideos(v);
    }, (error) => console.log("Videos listener error:", error));

    // 5. Updates
    const unsubUpdates = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'content_stream'), (snapshot) => {
      const u = [];
      snapshot.forEach(doc => u.push({ id: doc.id, ...doc.data() }));
      u.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setUpdates(u);
    }, (error) => console.log("Updates listener error:", error));

    return () => {
      unsubUser();
      unsubCourses();
      unsubPosts();
      unsubVideos();
      unsubUpdates();
    };
  }, [user]);

  // --- ACTIONS ---
  
  const handleNav = (page) => {
    setCurrentPage(page);
    setSidebarOpen(false);
    setCurrentModule(null);
    
    if (page.includes('forex')) setThemeColor('#ef4444');
    else if (page.includes('sales')) setThemeColor('#10b981');
    else if (page.includes('design')) setThemeColor('#f59e0b');
    else setThemeColor('#3b82f6');

    if (user && db) {
      let category = null;
      if (page.includes('forex')) category = 'forex';
      if (page.includes('sales')) category = 'sales';
      if (page.includes('design')) category = 'design';
      
      if (category) {
        const key = `visitCounts.${category}`;
        updateDoc(doc(db, 'artifacts', appId, 'users', user.uid), {
          [key]: increment(1)
        }).catch(err => console.log("Tracking error:", err));
      }
    }
  };

  const completeModule = async (moduleId, xpReward) => {
    if (!user || !db || userData.completedModules.includes(moduleId)) return;
    
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid), {
        completedModules: arrayUnion(moduleId),
        xp: increment(xpReward),
        streak: increment(0) 
      });
    } catch (e) {
      console.error("Completion error:", e);
    }
  };

  const toggleDarkMode = async () => {
    try {
      const newVal = !userData.settings?.darkMode;
      // Optimistic UI update
      if (newVal) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      
      if (user && db) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid), {
          'settings.darkMode': newVal
        });
      } else {
        // Local only fallback
        setUserData(prev => ({ ...prev, settings: { ...prev.settings, darkMode: newVal }}));
      }
    } catch (e) {
      console.error("Settings error:", e);
    }
  };

  const saveProfile = async (name, bio) => {
    try {
      if (user && db) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid), {
          displayName: name,
          bio: bio
        });
      } else {
        setUserData(prev => ({ ...prev, displayName: name, bio }));
      }
      handleNav('profile');
    } catch (e) {
      console.error("Save profile error:", e);
    }
  };

  // --- RENDERERS ---

  return (
    <div 
      className={`flex h-screen overflow-hidden bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-300`}
      style={{ '--theme': themeColor }}
    >
      {/* OVERLAY */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside 
        className={`fixed lg:relative z-50 w-64 h-full bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="p-6 flex items-center gap-2 font-display text-xl font-bold text-gray-900 dark:text-white">
          <TrendingUp className="text-[var(--theme)]" />
          GIP PRO
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <div className="px-3 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 mt-2">Main</div>
          <NavItem icon={LayoutGrid} label="Dashboard" active={currentPage === 'dashboard'} onClick={() => handleNav('dashboard')} />
          <NavItem icon={Bell} label="Updates" active={currentPage === 'updates'} onClick={() => handleNav('updates')} />
          <NavItem icon={Users} label="Community" active={currentPage === 'community'} onClick={() => handleNav('community')} />
          <NavItem icon={Archive} label="Offline Kit" active={currentPage === 'offline'} onClick={() => handleNav('offline')} />
          <NavItem icon={Video} label="Video Library" active={currentPage === 'videos'} onClick={() => handleNav('videos')} />

          <div className="px-3 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 mt-6">My Courses</div>
          <NavItem icon={TrendingUp} label="Forex Pro" active={currentPage.includes('forex')} onClick={() => handleNav('course-forex')} />
          <NavItem icon={Briefcase} label="Sales Mastery" active={currentPage.includes('sales')} onClick={() => handleNav('course-sales')} />
          <NavItem icon={PenTool} label="Graphic Design" active={currentPage.includes('design')} onClick={() => handleNav('course-design')} />
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-slate-700 space-y-1">
          <NavItem icon={User} label="Profile" active={currentPage === 'profile'} onClick={() => handleNav('profile')} />
          <NavItem icon={Settings} label="Settings" active={currentPage === 'settings'} onClick={() => handleNav('settings')} />
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* MOBILE HEADER */}
        <div className="lg:hidden p-4 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center z-30">
          <div className="font-bold font-display text-lg">GIP PRO</div>
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">
            <Menu size={24} />
          </button>
        </div>

        {/* SCROLLABLE AREA */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
          <div className="max-w-5xl mx-auto pb-20">
            
            {currentPage === 'dashboard' && (
              <Dashboard 
                user={userData} 
                courses={courses} 
                onNav={handleNav} 
                openReader={(m) => { setCurrentModule(m); setCurrentPage('reader'); }} 
              />
            )}

            {currentPage === 'videos' && (
              <VideoLibrary videos={videos} userData={userData} />
            )}

            {currentPage === 'updates' && (
              <UpdatesFeed updates={updates} userData={userData} />
            )}

            {currentPage === 'profile' && (
              <Profile user={userData} authUser={user} onEdit={() => handleNav('settings-edit')} />
            )}

            {currentPage === 'settings' && (
              <SettingsPage user={userData} toggleDark={toggleDarkMode} onEdit={() => handleNav('settings-edit')} />
            )}
            
            {currentPage === 'settings-edit' && (
              <EditProfile user={userData} onSave={saveProfile} onCancel={() => handleNav('settings')} />
            )}

            {currentPage === 'community' && (
              <Community posts={posts} user={userData} />
            )}

            {currentPage === 'offline' && <OfflineKit />}

            {/* COURSE PAGES */}
            {currentPage === 'course-forex' && (
              <CoursePage 
                id="forex" 
                title="Forex Trading Mastery" 
                color="red" 
                modules={courses.forex} 
                completed={userData.completedModules} 
                onOpen={(m) => { setCurrentModule(m); setCurrentPage('reader'); }}
                extraAction={<button onClick={() => handleNav('sim-forex')} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold transition">Open Simulator 📈</button>}
              />
            )}
            
            {currentPage === 'sim-forex' && (
              <ForexSimulator onBack={() => handleNav('course-forex')} />
            )}

            {currentPage === 'course-sales' && (
              <CoursePage 
                id="sales" 
                title="Sales Strategies" 
                color="green" 
                modules={courses.sales} 
                completed={userData.completedModules} 
                onOpen={(m) => { setCurrentModule(m); setCurrentPage('reader'); }}
                extraAction={<button onClick={() => setChatOpen(true)} className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold transition">Roleplay Chat 💬</button>}
              />
            )}

            {currentPage === 'course-design' && (
              <CoursePage 
                id="design" 
                title="Graphic Design" 
                color="yellow" 
                modules={courses.design} 
                completed={userData.completedModules} 
                onOpen={(m) => { setCurrentModule(m); setCurrentPage('reader'); }}
              />
            )}

            {/* READER */}
            {currentPage === 'reader' && currentModule && (
              <LessonReader 
                module={currentModule} 
                isComplete={userData.completedModules.includes(currentModule.id)}
                onComplete={() => completeModule(currentModule.id, 100)}
                onBack={() => handleNav(`course-${currentModule.courseId}`)}
              />
            )}

          </div>
        </div>
      </main>

      {/* FLOATING CHAT */}
      <FloatingChat isOpen={chatOpen} toggle={() => setChatOpen(!chatOpen)} user={userData} />
    </div>
  );
}

// --- SUB COMPONENTS ---

function NavItem({ icon: Icon, label, active, onClick }) {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 font-medium text-sm
        ${active 
          ? 'bg-[var(--theme)] text-white shadow-lg shadow-blue-500/20' 
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white'
        }`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </div>
  );
}

function Dashboard({ user, courses, onNav, openReader }) {
  const nextModule = useMemo(() => {
    const all = [...(courses.forex||[]), ...(courses.sales||[]), ...(courses.design||[])];
    return all.find(m => !user.completedModules.includes(m.id));
  }, [courses, user.completedModules]);

  return (
    <div className="animate-fade-in">
      <h1 className="text-3xl font-display font-bold mb-6 text-gray-900 dark:text-white">
        Hello, {(typeof user.displayName === 'string' ? user.displayName.split(' ')[0] : 'Student')}! 👋
      </h1>

      <div className="bg-slate-800 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden mb-8">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Sparkles size={100} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-blue-300 mb-1">Daily Focus</div>
            <h2 className="text-xl md:text-2xl font-bold">
              {nextModule ? `Continue: ${nextModule.title}` : "All Caught Up! 🎉"}
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              {nextModule ? "Keep your streak alive (+100 XP)" : "Review your certificates or check the community."}
            </p>
          </div>
          {nextModule && (
            <button 
              onClick={() => openReader(nextModule)}
              className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold flex items-center gap-2 transition"
            >
              Start Lesson <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>

      <h2 className="text-lg font-bold mb-4 border-t border-gray-200 dark:border-slate-700 pt-6">Course Shortcuts</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <CourseCard 
          title="Forex Mastery" 
          desc="Simulate trades & master markets." 
          color="border-red-500" 
          onClick={() => onNav('course-forex')}
        />
        <CourseCard 
          title="Sales Strategies" 
          desc="Roleplay negotiation scenarios." 
          color="border-green-500" 
          onClick={() => onNav('course-sales')}
        />
        <CourseCard 
          title="Graphic Design" 
          desc="Practice layout & typography." 
          color="border-yellow-500" 
          onClick={() => onNav('course-design')}
        />
      </div>
    </div>
  );
}

function CourseCard({ title, desc, color, onClick }) {
  return (
    <div 
      onClick={onClick}
      className={`bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md transition cursor-pointer border-t-4 ${color}`}
    >
      <h3 className="font-bold text-lg mb-2">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">{desc}</p>
    </div>
  );
}

function CoursePage({ id, title, color, modules, completed, onOpen, extraAction }) {
  const colorClasses = {
    red: 'text-red-500',
    green: 'text-green-500',
    yellow: 'text-yellow-500'
  };

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h1 className={`text-3xl font-display font-bold ${colorClasses[color]}`}>{title}</h1>
        {extraAction}
      </div>

      <div className="space-y-3">
        {(!modules || modules.length === 0) && <div className="text-gray-500 italic">No modules loaded yet.</div>}
        {modules && modules.map(m => {
          const isDone = completed.includes(m.id);
          return (
            <div key={m.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 flex justify-between items-center">
              <div className="flex items-center gap-3">
                {isDone 
                  ? <CheckCircle className="text-green-500" size={20} />
                  : <Circle className="text-gray-300 dark:text-slate-600" size={20} />
                }
                <span className={`font-medium ${isDone ? 'text-gray-500 line-through' : ''}`}>{m.title}</span>
              </div>
              <button 
                onClick={() => onOpen(m)}
                disabled={isDone}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wide rounded-md transition
                  ${isDone 
                    ? 'bg-gray-100 dark:bg-slate-700 text-gray-400 cursor-default' 
                    : 'bg-[var(--theme)] text-white hover:opacity-90'}`}
              >
                {isDone ? 'Completed' : 'Start'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LessonReader({ module, isComplete, onComplete, onBack }) {
  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <button onClick={onBack} className="text-sm font-semibold text-gray-500 hover:text-[var(--theme)] mb-4 flex items-center gap-1">
        &larr; Back to Course
      </button>

      <h1 className="text-3xl font-display font-bold text-[var(--theme)] mb-6">{module.title}</h1>

      {module.videoUrl && (
        <div className="aspect-video bg-black rounded-xl overflow-hidden mb-8 shadow-lg">
           <iframe 
            className="w-full h-full"
            src={module.videoUrl.replace('watch?v=', 'embed/').split('&')[0]} 
            frameBorder="0" 
            allowFullScreen
          />
        </div>
      )}

      {/* Offline Box */}
      <div className="bg-blue-50 dark:bg-slate-800/50 border border-blue-100 dark:border-slate-700 p-4 rounded-xl flex items-center gap-4 mb-8">
        <FolderDown className="text-blue-500" size={24} />
        <div className="flex-1">
          <div className="font-bold text-blue-900 dark:text-blue-100">Smart Offline Kit</div>
          <div className="text-xs text-blue-700 dark:text-blue-300">Download resources for offline study.</div>
        </div>
        <button className="text-blue-600 hover:bg-blue-100 dark:hover:bg-slate-700 p-2 rounded-lg text-sm font-semibold flex items-center gap-2">
          <Download size={16} /> Download
        </button>
      </div>

      <div className="prose dark:prose-invert max-w-none mb-10">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700">
           <h2 className="text-xl font-bold mb-4">Lesson Notes</h2>
           <p className="whitespace-pre-wrap leading-relaxed text-gray-600 dark:text-gray-300">
             {typeof module.body === 'string' ? module.body : "No text content provided for this lesson."}
           </p>
        </div>
      </div>

      <div className="flex justify-end pb-10">
        <button 
          onClick={onComplete}
          disabled={isComplete}
          className={`px-8 py-3 rounded-xl font-bold text-lg shadow-lg transition transform hover:-translate-y-1
            ${isComplete 
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 cursor-default shadow-none' 
              : 'bg-[var(--theme)] text-white hover:opacity-90'}`}
        >
          {isComplete ? 'Lesson Completed!' : 'Mark as Complete (+100 XP)'}
        </button>
      </div>
    </div>
  );
}

function ForexSimulator({ onBack }) {
  const canvasRef = useRef(null);
  const [balance, setBalance] = useState(10000);
  const [price, setPrice] = useState(1.1050);
  const dataPoints = useRef([1.1050]); 

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;

    const render = () => {
      const last = dataPoints.current[dataPoints.current.length - 1];
      const change = (Math.random() - 0.5) * 0.0010;
      const newPrice = last + change;
      dataPoints.current.push(newPrice);
      if (dataPoints.current.length > 100) dataPoints.current.shift();
      
      setPrice(newPrice); 

      // Draw
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Auto-resize
      canvas.width = canvas.parentElement.offsetWidth;
      canvas.height = canvas.parentElement.offsetHeight;

      const min = Math.min(...dataPoints.current);
      const max = Math.max(...dataPoints.current);
      const range = max - min || 0.0001;

      ctx.beginPath();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';

      dataPoints.current.forEach((p, i) => {
        const x = (i / 100) * canvas.width;
        const y = canvas.height - ((p - min) / range) * (canvas.height - 40) - 20;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, []);

  const trade = (type) => {
    const pnl = (Math.random() * 50) - 10;
    setBalance(b => b + pnl);
  };

  return (
    <div className="h-full flex flex-col animate-fade-in">
      <button onClick={onBack} className="text-sm font-semibold text-gray-500 mb-4 self-start">&larr; Exit Simulator</button>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[500px]">
        <div className="lg:col-span-3 bg-slate-900 rounded-2xl relative overflow-hidden p-4">
          <div className="absolute top-4 left-4 text-white font-mono z-10">
             <div className="text-sm text-slate-400">EUR/USD</div>
             <div className="text-2xl font-bold">{price.toFixed(4)}</div>
          </div>
          <canvas ref={canvasRef} className="w-full h-full block" />
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-200 dark:border-slate-700 flex flex-col gap-4">
           <div className="text-center p-4 bg-gray-50 dark:bg-slate-900 rounded-xl">
             <div className="text-xs text-gray-500 uppercase">Balance</div>
             <div className="text-2xl font-bold text-gray-900 dark:text-white">${balance.toFixed(2)}</div>
           </div>
           <button onClick={() => trade('buy')} className="w-full py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition">BUY</button>
           <button onClick={() => trade('sell')} className="w-full py-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition">SELL</button>
        </div>
      </div>
    </div>
  );
}

function Community({ posts, user }) {
  const [filter, setFilter] = useState('all');
  
  const filtered = filter === 'all' ? posts : posts.filter(p => p.courseId === filter);

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-display font-bold">Study Squads 👥</h1>
        <button className="bg-[var(--theme)] text-white px-4 py-2 rounded-lg text-sm font-bold">New Post</button>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-slate-700 pb-2 overflow-x-auto">
        {['all', 'forex', 'sales', 'design'].map(f => (
          <button 
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize whitespace-nowrap
              ${filter === f ? 'bg-gray-200 dark:bg-slate-700 text-black dark:text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
          >
            {f === 'all' ? 'All Squads' : f}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.length === 0 && <div className="text-center p-8 text-gray-500">No posts yet. Be the first!</div>}
        {filtered.map(p => (
          <div key={p.id} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400">
                {typeof p.authorName === 'string' ? p.authorName[0] : 'U'}
              </div>
              <div>
                <div className="text-sm font-bold">{p.authorName || 'Anonymous'}</div>
                <div className="text-xs text-gray-400 uppercase">{p.courseId} • Just now</div>
              </div>
            </div>
            <p className="text-gray-700 dark:text-gray-300">
              {typeof p.content === 'string' ? p.content : "Content not available."}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Profile({ user, authUser, onEdit }) {
  return (
    <div className="animate-fade-in">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-gray-200 dark:border-slate-700 flex flex-col md:flex-row items-center gap-8 mb-8">
        <div className="w-24 h-24 bg-[var(--theme)] rounded-full flex items-center justify-center text-4xl font-bold text-white">
          {typeof user.displayName === 'string' ? user.displayName[0] : 'U'}
        </div>
        <div className="text-center md:text-left flex-1">
          <h2 className="text-2xl font-bold">{user.displayName}</h2>
          <div className="text-gray-500 font-medium">@{authUser?.uid.substring(0,6)}</div>
          <p className="text-gray-600 dark:text-gray-400 mt-2 max-w-lg">{user.bio || "No bio yet."}</p>
          <div className="mt-4 flex gap-3 justify-center md:justify-start">
             <button onClick={onEdit} className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-slate-700 transition">Edit Profile</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatBox label="Streak" value={`${user.streak || 0} Days`} color="text-red-500" icon={Flame} />
        <StatBox label="Modules" value={user.completedModules?.length || 0} color="text-green-500" icon={CheckCircle} />
        <StatBox label="XP" value={user.xp || 0} color="text-blue-500" icon={Award} />
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 mb-6">
        <h3 className="font-bold mb-4 flex items-center gap-2"><Award className="text-yellow-500" /> Certificates</h3>
        {(!user.certificates || user.certificates.length === 0) 
          ? <div className="p-8 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-xl text-center text-gray-500">No certificates yet. Complete a course to earn one!</div>
          : <div>List of certs here...</div>
        }
      </div>
    </div>
  );
}

function StatBox({ label, value, color, icon: Icon }) {
  return (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 text-center">
      <div className={`text-2xl font-bold ${color} mb-1`}>{value}</div>
      <div className="text-xs text-gray-400 uppercase font-bold flex items-center justify-center gap-1">
        <Icon size={12} /> {label}
      </div>
    </div>
  );
}

function SettingsPage({ user, toggleDark, onEdit }) {
  return (
    <div className="animate-fade-in max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Settings ⚙️</h1>
      
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
          <h3 className="text-[var(--theme)] font-bold mb-4">Account</h3>
          <div className="flex justify-between items-center py-2">
             <div>
               <div className="font-semibold">Profile Details</div>
               <div className="text-xs text-gray-500">Name, bio, and avatar</div>
             </div>
             <button onClick={onEdit} className="px-3 py-1 bg-gray-100 dark:bg-slate-700 rounded-lg text-sm">Edit</button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
          <h3 className="text-[var(--theme)] font-bold mb-4">Appearance</h3>
          <div className="flex justify-between items-center py-2">
             <div>
               <div className="font-semibold">Dark Mode</div>
               <div className="text-xs text-gray-500">Switch between light and dark themes</div>
             </div>
             <div 
               onClick={toggleDark}
               className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-300 ${user.settings?.darkMode ? 'bg-[var(--theme)]' : 'bg-gray-300'}`}
             >
               <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${user.settings?.darkMode ? 'translate-x-6' : 'translate-x-0'}`} />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditProfile({ user, onSave, onCancel }) {
  const [name, setName] = useState(user.displayName || '');
  const [bio, setBio] = useState(user.bio || '');

  return (
    <div className="animate-fade-in max-w-xl">
      <h2 className="text-2xl font-bold mb-6">Edit Profile</h2>
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 space-y-4">
        <div>
          <label className="block text-sm font-bold mb-1">Display Name</label>
          <input 
            type="text" 
            value={name} 
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1">Bio</label>
          <textarea 
            rows="3"
            value={bio} 
            onChange={(e) => setBio(e.target.value)}
            className="w-full p-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-transparent"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={() => onSave(name, bio)} className="px-4 py-2 bg-[var(--theme)] text-white rounded-lg font-bold">Save Changes</button>
          <button onClick={onCancel} className="px-4 py-2 bg-gray-200 dark:bg-slate-700 rounded-lg font-bold">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function VideoLibrary({ videos, userData }) {
  // Simple Suggestion Algo
  const sorted = useMemo(() => {
    const counts = userData.visitCounts || { forex: 0, sales: 0, design: 0 };
    const topCat = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    
    return [...videos].sort((a, b) => {
       const aScore = (a.category === topCat ? 10 : 0);
       const bScore = (b.category === topCat ? 10 : 0);
       return bScore - aScore;
    });
  }, [videos, userData]);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold">Video Library 🎬</h1>
        <div className="relative flex-1 max-w-md">
           <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
           <input type="text" placeholder="Search videos..." className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800" />
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {sorted.length === 0 && <p className="text-gray-500">No videos found.</p>}
        {sorted.map(v => (
          <div key={v.id} onClick={() => window.open(v.videoUrl, '_blank')} className="group bg-white dark:bg-slate-800 rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700 cursor-pointer hover:-translate-y-1 transition duration-200">
            <div className="h-40 bg-black flex items-center justify-center relative">
               <PlayCircle className="text-white opacity-80 group-hover:scale-110 transition" size={48} />
               <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded font-bold uppercase">{v.category}</div>
            </div>
            <div className="p-4">
              <h3 className="font-bold line-clamp-2 leading-tight group-hover:text-[var(--theme)] transition">{v.title}</h3>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UpdatesFeed({ updates }) {
  return (
    <div className="animate-fade-in max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">Live Updates 🔔</h1>
      <div className="space-y-4">
        {updates.map(u => (
           <div key={u.id} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-l-4 hover:border-l-[var(--theme)] transition-all">
             <h3 className="font-bold mb-1">{u.title}</h3>
             <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
               {typeof u.body === 'string' ? u.body : "Update content unavailable."}
             </p>
             <div className="flex justify-between mt-3 text-xs text-gray-400 font-medium uppercase tracking-wide">
               <span>{u.type}</span>
               <span>{u.createdAt && u.createdAt.seconds ? new Date(u.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}</span>
             </div>
           </div>
        ))}
      </div>
    </div>
  );
}

function OfflineKit() {
  return (
    <div className="animate-fade-in">
      <h1 className="text-3xl font-bold mb-2">My Offline Kit 📦</h1>
      <p className="text-gray-500 mb-8">Access your downloaded notes and resources.</p>
      
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700">
        <h3 className="font-bold mb-4">Downloaded Resources</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           <div className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-900 flex flex-col gap-2">
             <Archive className="text-[var(--theme)]" />
             <div className="font-bold text-sm">FX101 Notes.pdf</div>
             <div className="text-xs text-gray-500">Module: Leverage</div>
           </div>
        </div>
      </div>
    </div>
  );
}

function FloatingChat({ isOpen, toggle, user }) {
  const [msg, setMsg] = useState('');
  const [history, setHistory] = useState([
    { role: 'bot', text: 'Hello! I\'m your GIP Pro Tutor. Ask me about Forex, Sales, or Design!' }
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history, isOpen]);

  const send = async () => {
    if (!msg.trim()) return;
    const newMsg = { role: 'user', text: msg };
    setHistory(prev => [...prev, newMsg]);
    setMsg('');
    setLoading(true);

    try {
      const apiKey = ""; // Canvas Env handles key
      const sysPrompt = `You are a motivating AI Tutor. User: ${user.displayName}. Keep answers short and educational.`;
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: newMsg.text }] }],
          systemInstruction: { parts: [{ text: sysPrompt }] }
        })
      });
      
      const data = await response.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't connect.";
      setHistory(prev => [...prev, { role: 'bot', text: reply }]);
    } catch (e) {
      setHistory(prev => [...prev, { role: 'bot', text: "Error connecting to AI." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={toggle}
        className="fixed bottom-8 right-8 w-14 h-14 bg-gray-900 text-white rounded-2xl shadow-xl flex items-center justify-center hover:scale-105 transition z-50"
      >
        {isOpen ? <X /> : <MessageCircle />}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-8 w-80 md:w-96 h-[500px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 flex flex-col overflow-hidden z-50 animate-fade-up">
          <div className="p-4 bg-[var(--theme)] text-white font-bold flex justify-between items-center">
            <span className="flex items-center gap-2"><Sparkles size={16} /> AI Tutor</span>
            <button onClick={toggle}><X size={16} /></button>
          </div>
          
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-slate-950">
             {history.map((h, i) => (
               <div key={i} className={`flex ${h.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                 <div className={`max-w-[85%] p-3 rounded-xl text-sm ${h.role === 'user' ? 'bg-[var(--theme)] text-white rounded-tr-sm' : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-tl-sm'}`}>
                   {h.text}
                 </div>
               </div>
             ))}
             {loading && (
               <div className="flex justify-start">
                 <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-200 dark:border-slate-700 rounded-tl-sm flex items-center gap-2 text-sm text-gray-500">
                   <Loader className="animate-spin" size={14} /> Thinking...
                 </div>
               </div>
             )}
          </div>

          <div className="p-3 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 flex gap-2">
            <input 
              type="text" 
              value={msg} 
              onChange={e => setMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Ask anything..." 
              className="flex-1 bg-gray-100 dark:bg-slate-800 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--theme)]"
            />
            <button onClick={send} className="p-2 bg-[var(--theme)] text-white rounded-xl"><Send size={18} /></button>
          </div>
        </div>
      )}
    </>
  );
}