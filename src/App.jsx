import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  LayoutGrid, Bell, Users, Archive, Video, TrendingUp, 
  Briefcase, PenTool, User, Settings, Menu, X, 
  Sparkles, PlayCircle, Award, CheckCircle, Circle, 
  Flame, Download, FolderDown, MessageCircle, Send,
  Loader, ArrowRight, Search, AlertTriangle, Plus,
  Heart, Share2, MoreHorizontal, BookOpen, Trash2, LogOut
} from 'lucide-react';
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged,
  signOut
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  onSnapshot, 
  updateDoc, 
  increment, 
  arrayUnion, 
  arrayRemove,
  addDoc,
  serverTimestamp 
} from "firebase/firestore";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyAGkGVHJmnWOyPY_ka_arfHo4QwkW1feAE",
  authDomain: "gip-pro-training.firebaseapp.com",
  projectId: "gip-pro-training",
  storageBucket: "gip-pro-training.firebasestorage.app",
  messagingSenderId: "150694855839",
  appId: "1:150694855839:web:d4412e99068fffadda8eaa",
  measurementId: "G-THSQ4GFJG1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "gip-pro-training"; // or your Firestore document ID

// Fallback for auth token
const __initial_auth_token = null;

// --- MAIN APP COMPONENT ---
export default function App() {
  // ... rest of your code
  // --- STATE ---
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState({
    displayName: 'Student',
    bio: 'Ready to learn!',
    jobTitle: 'Aspiring Pro',
    xp: 0,
    streak: 1,
    completedModules: [],
    savedResources: [], // For Offline Kit
    visitCounts: { forex: 0, sales: 0, design: 0 },
    settings: { darkMode: false }
  });
  
  // Navigation & UI
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [themeColor, setThemeColor] = useState('#2563eb'); // Default Blue
  const [chatOpen, setChatOpen] = useState(false);
  const [postModalOpen, setPostModalOpen] = useState(false);
  
  // Data
  const [courses, setCourses] = useState({ forex: [], sales: [], design: [] });
  const [posts, setPosts] = useState([]);
  const [videos, setVideos] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [currentModule, setCurrentModule] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- AUTH & INIT ---
  useEffect(() => {
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
        // Create user doc if not exists
        const userRef = doc(db, 'artifacts', appId, 'users', u.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
           await setDoc(userRef, { 
             displayName: 'Student', 
             xp: 0, 
             joinedAt: serverTimestamp(),
             savedResources: [] 
           }, { merge: true });
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- DATA LISTENERS ---
  useEffect(() => {
    if (!user) return;

    // 1. User Profile
    const unsubUser = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData(prev => ({ ...prev, ...data }));
        // Apply Dark Mode Preference
        if (data.settings?.darkMode) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
      }
    });

    // 2. Courses (Public Data)
    const unsubCourses = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'course_modules'), (snapshot) => {
      const newCourses = { forex: [], sales: [], design: [] };
      snapshot.forEach(doc => {
        const d = { id: doc.id, ...doc.data() };
        if (newCourses[d.courseId]) newCourses[d.courseId].push(d);
      });
      // Sort by order
      Object.keys(newCourses).forEach(k => {
        newCourses[k].sort((a, b) => (a.order || 0) - (b.order || 0));
      });
      setCourses(newCourses);
    });

    // 3. Community Posts
    const unsubPosts = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'community_posts'), (snapshot) => {
      const p = [];
      snapshot.forEach(doc => p.push({ id: doc.id, ...doc.data() }));
      p.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setPosts(p);
    });

    return () => {
      unsubUser();
      unsubCourses();
      unsubPosts();
    };
  }, [user]);

  // --- ACTIONS ---

  const handleNav = (page) => {
    setCurrentPage(page);
    setSidebarOpen(false);
    setCurrentModule(null);
    
    // Theme switching based on context
    if (page.includes('forex')) setThemeColor('#ef4444'); // Red
    else if (page.includes('sales')) setThemeColor('#10b981'); // Emerald
    else if (page.includes('design')) setThemeColor('#f59e0b'); // Amber
    else setThemeColor('#2563eb'); // Blue
  };

  const completeModule = async (moduleId, xpReward) => {
    if (!user || userData.completedModules.includes(moduleId)) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid), {
        completedModules: arrayUnion(moduleId),
        xp: increment(xpReward),
        streak: increment(1) 
      });
    } catch (e) { console.error(e); }
  };

  const toggleSaveResource = async (module) => {
    if (!user) return;
    const isSaved = userData.savedResources?.some(r => r.id === module.id);
    const ref = doc(db, 'artifacts', appId, 'users', user.uid);
    
    try {
      if (isSaved) {
        // We can't easily remove objects from array without exact match in Firestore, 
        // so we filter strictly in a real app, but for this demo assume simple objects
        // A better way is to read, filter, write, but arrayRemove works if object is identical
        const itemToRemove = userData.savedResources.find(r => r.id === module.id);
        await updateDoc(ref, { savedResources: arrayRemove(itemToRemove) });
      } else {
        await updateDoc(ref, { 
          savedResources: arrayUnion({ 
            id: module.id, 
            title: module.title, 
            courseId: module.courseId,
            savedAt: Date.now() 
          }) 
        });
      }
    } catch (e) { console.error("Save resource error:", e); }
  };

  const createPost = async (content, courseId = 'general') => {
    if (!user || !content.trim()) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'community_posts'), {
        content,
        courseId,
        authorId: user.uid,
        authorName: userData.displayName || 'Anonymous',
        likes: 0,
        createdAt: serverTimestamp()
      });
      setPostModalOpen(false);
    } catch (e) { console.error("Post error:", e); }
  };

  const saveProfile = async (data) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid), data);
      handleNav('profile');
    } catch (e) { console.error(e); }
  };

  const resetProgress = async () => {
    if(!user || !confirm("Are you sure? This will wipe all your XP and certificates.")) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid), {
        xp: 0,
        completedModules: [],
        savedResources: [],
        streak: 0
      });
      alert("Progress reset.");
    } catch(e) { console.error(e); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white text-blue-600">
      <Loader className="animate-spin" size={40} />
    </div>
  );

  return (
    <div 
      className="flex h-screen overflow-hidden bg-gray-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-300 selection:bg-[var(--theme)] selection:text-white"
      style={{ '--theme': themeColor }}
    >
      {/* --- SIDEBAR --- */}
      <aside 
        className={`fixed lg:relative z-50 w-[280px] h-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[var(--theme)] to-blue-400 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <TrendingUp size={20} />
          </div>
          <span className="font-display text-xl font-bold tracking-tight">GIP PRO</span>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto p-2 text-slate-400 hover:text-slate-600"><X size={20}/></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1 custom-scrollbar">
          <div className="px-4 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Menu</div>
          <NavItem icon={LayoutGrid} label="Dashboard" active={currentPage === 'dashboard'} onClick={() => handleNav('dashboard')} />
          <NavItem icon={Bell} label="Updates" active={currentPage === 'updates'} onClick={() => handleNav('updates')} />
          <NavItem icon={Users} label="Community" active={currentPage === 'community'} onClick={() => handleNav('community')} />
          <NavItem icon={Archive} label="Offline Kit" active={currentPage === 'offline'} onClick={() => handleNav('offline')} />
          <NavItem icon={Video} label="Video Library" active={currentPage === 'videos'} onClick={() => handleNav('videos')} />

          <div className="px-4 py-2 mt-8 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Learning Paths</div>
          <NavItem icon={TrendingUp} label="Forex Mastery" active={currentPage.includes('forex')} onClick={() => handleNav('course-forex')} color="text-red-500" />
          <NavItem icon={Briefcase} label="Sales Strategies" active={currentPage.includes('sales')} onClick={() => handleNav('course-sales')} color="text-emerald-500" />
          <NavItem icon={PenTool} label="Graphic Design" active={currentPage.includes('design')} onClick={() => handleNav('course-design')} color="text-amber-500" />
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleNav('profile')}>
             <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-[var(--theme)] font-bold shadow-sm">
               {userData.displayName[0]}
             </div>
             <div className="flex-1 min-w-0">
               <div className="text-sm font-bold truncate">{userData.displayName}</div>
               <div className="text-xs text-slate-500 truncate">Lvl {Math.floor(userData.xp / 1000) + 1} Student</div>
             </div>
             <Settings size={16} className="text-slate-400" />
          </div>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-white/50 dark:bg-slate-950">
        
        {/* Mobile Header */}
        <div className="lg:hidden h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 z-20">
          <span className="font-display font-bold text-lg">GIP PRO</span>
          <button onClick={() => setSidebarOpen(true)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg"><Menu size={20}/></button>
        </div>

        {/* Scroll Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-10 scroll-smooth custom-scrollbar">
          <div className="max-w-6xl mx-auto pb-24">
            
            {currentPage === 'dashboard' && (
              <Dashboard 
                user={userData} 
                courses={courses} 
                onNav={handleNav} 
                openReader={(m) => { setCurrentModule(m); setCurrentPage('reader'); }} 
              />
            )}

            {currentPage === 'community' && (
              <Community 
                posts={posts} 
                user={userData} 
                onOpenPostModal={() => setPostModalOpen(true)} 
              />
            )}

            {currentPage === 'offline' && (
              <OfflineKit 
                saved={userData.savedResources || []} 
                onOpen={(id) => {
                   // Find module in courses
                   let found = null;
                   Object.values(courses).forEach(list => {
                     const m = list.find(x => x.id === id);
                     if (m) found = m;
                   });
                   if (found) { setCurrentModule(found); setCurrentPage('reader'); }
                }}
                onRemove={toggleSaveResource}
              />
            )}

            {currentPage === 'profile' && (
              <Profile user={userData} onEdit={() => handleNav('settings-edit')} />
            )}

            {currentPage === 'settings-edit' && (
              <EditProfile 
                user={userData} 
                onSave={saveProfile} 
                onCancel={() => handleNav('profile')} 
                onReset={resetProgress}
              />
            )}

            {/* Course Pages */}
            {['forex', 'sales', 'design'].map(cid => (
              currentPage === `course-${cid}` && (
                <CoursePage 
                  key={cid}
                  id={cid}
                  title={cid === 'forex' ? 'Forex Trading' : cid === 'sales' ? 'Sales Mastery' : 'Graphic Design'}
                  modules={courses[cid]}
                  completed={userData.completedModules}
                  onOpen={(m) => { setCurrentModule(m); setCurrentPage('reader'); }}
                />
              )
            ))}

            {/* Reader */}
            {currentPage === 'reader' && currentModule && (
              <LessonReader 
                module={currentModule} 
                isComplete={userData.completedModules.includes(currentModule.id)}
                isSaved={userData.savedResources?.some(r => r.id === currentModule.id)}
                onComplete={() => completeModule(currentModule.id, 100)}
                onToggleSave={() => toggleSaveResource(currentModule)}
                onBack={() => handleNav(`course-${currentModule.courseId}`)}
              />
            )}

          </div>
        </div>
      </main>

      {/* --- MODALS & OVERLAYS --- */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      
      {postModalOpen && (
        <CreatePostModal 
          onClose={() => setPostModalOpen(false)} 
          onSubmit={createPost} 
        />
      )}

      <FloatingChat isOpen={chatOpen} toggle={() => setChatOpen(!chatOpen)} user={userData} />
    </div>
  );
}

// --- SUB-COMPONENTS ---

function NavItem({ icon: Icon, label, active, onClick, color }) {
  return (
    <div 
      onClick={onClick}
      className={`group flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer transition-all duration-300 font-medium text-[13px]
        ${active 
          ? 'bg-[var(--theme)] text-white shadow-md shadow-blue-500/20 translate-x-1' 
          : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
        }`}
    >
      <Icon size={18} className={`${!active && color ? color : ''} transition-transform group-hover:scale-110`} />
      <span>{label}</span>
      {active && <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full" />}
    </div>
  );
}

function Dashboard({ user, courses, onNav, openReader }) {
  const nextModule = useMemo(() => {
    const all = [...(courses.forex||[]), ...(courses.sales||[]), ...(courses.design||[])];
    return all.find(m => !user.completedModules.includes(m.id));
  }, [courses, user.completedModules]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="mb-10">
        <h1 className="text-4xl font-display font-bold text-slate-900 dark:text-white mb-2">
          Welcome back, {user.displayName.split(' ')[0]}!
        </h1>
        <p className="text-slate-500 text-lg">You're on a <span className="text-[var(--theme)] font-bold">{user.streak} day streak</span>. Keep it up!</p>
      </header>

      {/* Hero Card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8 rounded-[2rem] shadow-2xl relative overflow-hidden mb-12 group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-white/10 transition duration-700" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs font-bold uppercase tracking-widest mb-4 backdrop-blur-md">
              <Sparkles size={12} className="text-yellow-400" /> Daily Focus
            </div>
            <h2 className="text-3xl font-bold mb-2 max-w-lg leading-tight">
              {nextModule ? nextModule.title : "All Systems Go! 🚀"}
            </h2>
            <p className="text-slate-400 max-w-md">
              {nextModule ? "Continue your learning path to earn your next certificate." : "You've completed all available modules. Check the community for new challenges."}
            </p>
          </div>
          
          {nextModule && (
            <button 
              onClick={() => openReader(nextModule)}
              className="px-6 py-3 bg-white text-slate-900 rounded-xl font-bold flex items-center gap-2 hover:scale-105 transition shadow-lg shadow-white/20"
            >
              Continue Lesson <ArrowRight size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        <StatCard icon={Flame} label="Day Streak" value={user.streak} color="text-orange-500" bg="bg-orange-50 dark:bg-orange-900/20" />
        <StatCard icon={CheckCircle} label="Completed" value={user.completedModules.length} color="text-green-500" bg="bg-green-50 dark:bg-green-900/20" />
        <StatCard icon={Award} label="Total XP" value={user.xp} color="text-blue-500" bg="bg-blue-50 dark:bg-blue-900/20" />
        <StatCard icon={Archive} label="Saved Items" value={user.savedResources?.length || 0} color="text-purple-500" bg="bg-purple-50 dark:bg-purple-900/20" />
      </div>

      <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-800 dark:text-white">
        <TrendingUp size={20} className="text-[var(--theme)]" /> Your Pathways
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <CourseCard 
          title="Forex Mastery" 
          tags={['Finance', 'Simulation']}
          progress={courses.forex?.length ? Math.round((courses.forex.filter(m => user.completedModules.includes(m.id)).length / courses.forex.length) * 100) : 0}
          color="bg-red-500" 
          onClick={() => onNav('course-forex')}
        />
        <CourseCard 
          title="Sales Strategies" 
          tags={['Business', 'Roleplay']}
          progress={courses.sales?.length ? Math.round((courses.sales.filter(m => user.completedModules.includes(m.id)).length / courses.sales.length) * 100) : 0}
          color="bg-emerald-500" 
          onClick={() => onNav('course-sales')}
        />
        <CourseCard 
          title="Graphic Design" 
          tags={['Creative', 'Portfolio']}
          progress={courses.design?.length ? Math.round((courses.design.filter(m => user.completedModules.includes(m.id)).length / courses.design.length) * 100) : 0}
          color="bg-amber-500" 
          onClick={() => onNav('course-design')}
        />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bg }) {
  return (
    <div className={`p-5 rounded-2xl border border-slate-100 dark:border-slate-800 ${bg} flex flex-col items-center justify-center text-center gap-2 hover:scale-105 transition-transform`}>
      <Icon size={24} className={color} />
      <div>
        <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
}

function CourseCard({ title, tags, progress, color, onClick }) {
  return (
    <div 
      onClick={onClick}
      className="group bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none hover:shadow-2xl hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden"
    >
      <div className={`absolute top-0 left-0 w-full h-1 ${color}`} />
      
      <div className="flex justify-between items-start mb-4">
        <div className={`w-12 h-12 rounded-2xl ${color} bg-opacity-10 flex items-center justify-center`}>
          <TrendingUp className={color.replace('bg-', 'text-')} size={24} />
        </div>
        <div className="text-xl font-bold text-slate-200 group-hover:text-slate-300">{progress}%</div>
      </div>
      
      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
      <div className="flex gap-2 mb-6">
        {tags.map(t => (
          <span key={t} className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-1 rounded-md">{t}</span>
        ))}
      </div>
      
      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-1000`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function Community({ posts, user, onOpenPostModal }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">Community Hub</h1>
          <p className="text-slate-500">Connect, share, and grow with other students.</p>
        </div>
        <button 
          onClick={onOpenPostModal}
          className="px-5 py-2.5 bg-[var(--theme)] hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 transition flex items-center gap-2"
        >
          <Plus size={18} /> New Post
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Feed */}
        <div className="lg:col-span-2 space-y-6">
          {posts.length === 0 && (
            <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300">
              <MessageCircle size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">No conversations yet. Start one!</p>
            </div>
          )}
          
          {posts.map(post => (
            <div key={post.id} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-600 dark:text-slate-400">
                    {post.authorName?.[0] || 'A'}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">{post.authorName}</div>
                    <div className="text-xs text-slate-400">
                      {post.createdAt?.seconds ? new Date(post.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}
                    </div>
                  </div>
                </div>
                <button className="text-slate-400 hover:text-slate-600"><MoreHorizontal size={20} /></button>
              </div>
              
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-6">
                {post.content}
              </p>

              <div className="flex items-center gap-6 pt-4 border-t border-slate-50 dark:border-slate-800">
                <button className="flex items-center gap-2 text-slate-500 hover:text-pink-500 transition text-sm font-medium">
                  <Heart size={18} /> {post.likes || 0}
                </button>
                <button className="flex items-center gap-2 text-slate-500 hover:text-blue-500 transition text-sm font-medium">
                  <MessageCircle size={18} /> Reply
                </button>
                <button className="flex items-center gap-2 text-slate-500 hover:text-green-500 transition text-sm font-medium ml-auto">
                  <Share2 size={18} /> Share
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl p-6 text-white shadow-xl">
             <h3 className="font-bold text-lg mb-2">Weekly Challenge</h3>
             <p className="text-white/80 text-sm mb-4">Post your best Forex trade setup analysis this week to win 500 XP!</p>
             <button className="w-full py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-bold backdrop-blur">View Details</button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800">
             <h3 className="font-bold text-slate-900 dark:text-white mb-4">Top Contributors</h3>
             <div className="space-y-4">
                {[1,2,3].map(i => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center font-bold text-xs">#{i}</div>
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300">Student Name</div>
                    <div className="ml-auto text-xs font-bold text-[var(--theme)]">{1000 - (i*100)} XP</div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreatePostModal({ onClose, onSubmit }) {
  const [text, setText] = useState('');
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
        <h2 className="text-xl font-bold mb-4">Create New Post</h2>
        <textarea 
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What's on your mind?"
          className="w-full h-32 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl resize-none focus:ring-2 focus:ring-[var(--theme)] outline-none mb-4"
        />
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-xl">Cancel</button>
          <button 
            onClick={() => onSubmit(text)} 
            disabled={!text.trim()}
            className="px-6 py-2 bg-[var(--theme)] text-white font-bold rounded-xl disabled:opacity-50"
          >
            Post
          </button>
        </div>
      </div>
    </div>
  );
}

function OfflineKit({ saved, onOpen, onRemove }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">Offline Kit 📦</h1>
        <p className="text-slate-500">Your collection of saved lessons and resources.</p>
      </div>

      {saved.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
           <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-300 mb-4">
             <Archive size={40} />
           </div>
           <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">It's empty here</h3>
           <p className="text-slate-500 max-w-xs mx-auto mt-2">
             Click the "Save for Offline" button on any lesson to add it to your kit.
           </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {saved.map(item => (
            <div key={item.id} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 group hover:border-[var(--theme)] transition-colors">
              <div className="flex items-start justify-between mb-4">
                 <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl">
                   <BookOpen size={24} />
                 </div>
                 <button onClick={() => onRemove(item)} className="p-2 text-slate-300 hover:text-red-500 transition">
                   <Trash2 size={18} />
                 </button>
              </div>
              <h3 className="font-bold text-lg mb-2 line-clamp-2">{item.title}</h3>
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-6">Saved on {new Date(item.savedAt).toLocaleDateString()}</div>
              
              <button 
                onClick={() => onOpen(item.id)}
                className="w-full py-3 bg-slate-50 dark:bg-slate-800 hover:bg-[var(--theme)] hover:text-white text-slate-700 font-bold rounded-xl transition-all"
              >
                Open Resource
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Profile({ user, onEdit }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
      {/* Profile Header */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 dark:shadow-none mb-8 border border-slate-100 dark:border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-blue-500 to-indigo-600" />
        
        <div className="relative pt-16 flex flex-col md:flex-row items-end md:items-center gap-6">
          <div className="w-32 h-32 rounded-3xl bg-white p-1 shadow-lg -mb-4 md:mb-0">
            <div className="w-full h-full bg-slate-100 rounded-2xl flex items-center justify-center text-4xl font-bold text-slate-400">
               {user.displayName?.[0]}
            </div>
          </div>
          <div className="flex-1 mb-2">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{user.displayName}</h2>
            <p className="text-slate-500 font-medium">{user.jobTitle || 'Student'}</p>
          </div>
          <button onClick={onEdit} className="mb-4 px-6 py-2 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition">
            Edit Profile
          </button>
        </div>

        <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">About Me</h3>
          <p className="text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            {user.bio}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800">
          <h3 className="font-bold text-xl mb-6 flex items-center gap-2"><Award className="text-yellow-500" /> Certificates</h3>
          <div className="p-8 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-center text-slate-400">
            <div className="mb-2">🏆</div>
            No certificates earned yet.
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800">
          <h3 className="font-bold text-xl mb-6 flex items-center gap-2"><Settings className="text-slate-400" /> Quick Settings</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
              <span className="font-medium text-slate-700 dark:text-slate-300">Dark Mode</span>
              <div className="w-12 h-6 bg-slate-300 dark:bg-slate-600 rounded-full p-1 relative">
                 <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${user.settings?.darkMode ? 'translate-x-6' : ''}`} />
              </div>
            </div>
            <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
               <span className="font-medium text-slate-700 dark:text-slate-300">Email Notifications</span>
               <div className="w-12 h-6 bg-[var(--theme)] rounded-full p-1 relative">
                 <div className="w-4 h-4 bg-white rounded-full shadow-sm translate-x-6" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditProfile({ user, onSave, onCancel, onReset }) {
  const [form, setForm] = useState({ 
    displayName: user.displayName, 
    jobTitle: user.jobTitle || '',
    bio: user.bio 
  });

  return (
    <div className="max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-3xl font-bold mb-8">Profile Settings</h2>
      
      <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 space-y-6">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Display Name</label>
          <input 
            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[var(--theme)] outline-none transition"
            value={form.displayName}
            onChange={e => setForm({...form, displayName: e.target.value})}
          />
        </div>
        
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Job Title / Role</label>
          <input 
            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[var(--theme)] outline-none transition"
            value={form.jobTitle}
            onChange={e => setForm({...form, jobTitle: e.target.value})}
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Bio</label>
          <textarea 
            rows="4"
            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[var(--theme)] outline-none transition resize-none"
            value={form.bio}
            onChange={e => setForm({...form, bio: e.target.value})}
          />
        </div>

        <div className="flex gap-4 pt-4">
          <button onClick={() => onSave(form)} className="flex-1 py-3 bg-[var(--theme)] text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:scale-[1.02] transition">Save Changes</button>
          <button onClick={onCancel} className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition">Cancel</button>
        </div>
      </div>

      <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800">
        <h3 className="text-red-500 font-bold mb-4">Danger Zone</h3>
        <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/20">
          <div className="text-sm text-red-700 dark:text-red-400">Reset all progress and XP</div>
          <button onClick={onReset} className="px-4 py-2 bg-white text-red-500 text-sm font-bold rounded-lg border border-red-200 hover:bg-red-50">Reset</button>
        </div>
      </div>
    </div>
  );
}

function CoursePage({ id, title, modules, completed, onOpen }) {
  const color = id === 'forex' ? 'text-red-500' : id === 'sales' ? 'text-emerald-500' : 'text-amber-500';

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-8">
        <h1 className={`text-4xl font-display font-bold ${color}`}>{title}</h1>
        <div className="text-sm font-bold text-slate-400">{completed.filter(c => modules?.some(m => m.id === c)).length} / {modules?.length || 0} Completed</div>
      </div>

      <div className="space-y-4 max-w-4xl">
        {(!modules || modules.length === 0) && <div className="text-slate-400 italic">Modules coming soon...</div>}
        {modules && modules.map((m, i) => {
          const isDone = completed.includes(m.id);
          return (
            <div key={m.id} className="group bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition flex items-center gap-4">
              <div className="font-display font-bold text-2xl text-slate-200 w-8">{(i + 1).toString().padStart(2, '0')}</div>
              <div className="flex-1">
                <h3 className={`font-bold text-lg ${isDone ? 'text-slate-500' : 'text-slate-900 dark:text-white'}`}>{m.title}</h3>
                <div className="text-xs text-slate-400 mt-1">{isDone ? 'Completed' : `${m.duration || '10'} min read`}</div>
              </div>
              <button 
                onClick={() => onOpen(m)}
                className={`px-6 py-2 rounded-xl font-bold text-sm transition-all
                  ${isDone 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-slate-900 text-white hover:bg-[var(--theme)] shadow-lg hover:shadow-[var(--theme)]/20'}`}
              >
                {isDone ? 'Review' : 'Start'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LessonReader({ module, isComplete, isSaved, onComplete, onToggleSave, onBack }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 max-w-3xl mx-auto">
      <button onClick={onBack} className="text-sm font-bold text-slate-400 hover:text-[var(--theme)] mb-6 flex items-center gap-2 transition">
        <ArrowRight className="rotate-180" size={16} /> Back to Course
      </button>

      <div className="flex justify-between items-start mb-8">
        <h1 className="text-4xl font-display font-bold text-slate-900 dark:text-white leading-tight">{module.title}</h1>
        <button 
          onClick={onToggleSave}
          className={`p-3 rounded-xl transition border ${isSaved ? 'bg-[var(--theme)] text-white border-transparent' : 'bg-white text-slate-400 border-slate-200 hover:border-[var(--theme)] hover:text-[var(--theme)]'}`}
        >
           {isSaved ? <CheckCircle size={24} /> : <Download size={24} />}
        </button>
      </div>

      {module.videoUrl && (
        <div className="aspect-video bg-black rounded-3xl overflow-hidden mb-10 shadow-2xl">
           <iframe 
            className="w-full h-full"
            src={module.videoUrl.replace('watch?v=', 'embed/').split('&')[0]} 
            frameBorder="0" 
            allowFullScreen
          />
        </div>
      )}

      <article className="prose prose-lg dark:prose-invert max-w-none mb-12">
        <div className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
          {module.body || "Content loading..."}
        </div>
      </article>

      <div className="flex justify-center pb-20">
        <button 
          onClick={onComplete}
          disabled={isComplete}
          className={`px-10 py-4 rounded-2xl font-bold text-xl shadow-xl transition transform hover:-translate-y-1 active:scale-95
            ${isComplete 
              ? 'bg-green-500 text-white cursor-default' 
              : 'bg-[var(--theme)] text-white hover:opacity-90'}`}
        >
          {isComplete ? 'Lesson Completed' : 'Mark Complete (+100 XP)'}
        </button>
      </div>
    </div>
  );
}

function FloatingChat({ isOpen, toggle, user }) {
  const [msg, setMsg] = useState('');
  const [history, setHistory] = useState([
    { role: 'bot', text: `Hi ${user.displayName.split(' ')[0]}! I'm your AI Tutor. Need help with the lesson?` }
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
      const apiKey = ""; 
      const sysPrompt = `You are a helpful Tutor. User: ${user.displayName}. Keep answers short (under 50 words).`;
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: newMsg.text }] }],
          systemInstruction: { parts: [{ text: sysPrompt }] }
        })
      });
      
      const data = await response.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Connection error.";
      setHistory(prev => [...prev, { role: 'bot', text: reply }]);
    } catch (e) {
      setHistory(prev => [...prev, { role: 'bot', text: "Offline mode." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={toggle}
        className="fixed bottom-8 right-8 w-14 h-14 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center justify-center hover:scale-110 transition z-50"
      >
        {isOpen ? <X /> : <MessageCircle />}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-8 w-80 md:w-96 h-[500px] bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden z-50 animate-in slide-in-from-bottom-10 duration-300">
          <div className="p-5 bg-slate-900 text-white font-bold flex justify-between items-center">
            <span className="flex items-center gap-2"><Sparkles size={16} className="text-yellow-400" /> AI Tutor</span>
          </div>
          
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-950">
             {history.map((h, i) => (
               <div key={i} className={`flex ${h.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                 <div className={`max-w-[85%] p-3 px-4 rounded-2xl text-sm ${h.role === 'user' ? 'bg-[var(--theme)] text-white rounded-br-none' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-bl-none shadow-sm'}`}>
                   {h.text}
                 </div>
               </div>
             ))}
             {loading && <div className="text-xs text-slate-400 ml-4">Typing...</div>}
          </div>

          <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex gap-2">
            <input 
              value={msg} 
              onChange={e => setMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Ask anything..." 
              className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--theme)]"
            />
            <button onClick={send} className="p-2 bg-[var(--theme)] text-white rounded-xl"><Send size={18} /></button>
          </div>
        </div>
      )}
    </>
  );
}
