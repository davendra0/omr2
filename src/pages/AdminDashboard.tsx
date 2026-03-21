import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '@/firebase';
import { collection, query, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/components/AuthProvider';
import { format } from 'date-fns';
import { Search, ArrowLeft, User, Calendar, Award, ExternalLink } from 'lucide-react';
import { useTestStore } from '@/store/testStore';

interface Submission {
  id: string;
  testId: string;
  userId: string;
  score: number;
  answers: Record<string, string | null>;
  completedAt: Timestamp;
  userEmail?: string;
  testTitle?: string;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setResult, setAnswerKey } = useTestStore();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const isAdmin = user?.email === 'manishayadav0512198500@gmail.com' || localStorage.getItem('admin_passcode') === "Davendra@07";

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }

    const fetchSubmissions = async () => {
      try {
        const q = query(collection(db, 'submissions'), orderBy('completedAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Submission[];
        setSubmissions(data);
      } catch (error) {
        console.error("Error fetching submissions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubmissions();
  }, [isAdmin, navigate]);

  const filtered = submissions.filter(s => 
    s.testId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.userId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.userEmail && s.userEmail.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleViewSubmission = async (sub: Submission) => {
    // To view, we need to reconstruct the result object
    // This is a bit tricky because we might not have the full config here
    // For now, let's just navigate to a special review route if we implement it
    // Or we can try to find the test config from 'tests' collection
    navigate(`/results/submission/${sub.id}`);
  };

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-muted rounded-full transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold font-mono text-foreground">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">Monitor all user test submissions</p>
            </div>
          </div>
        </header>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input
            type="text"
            placeholder="Search by Test ID, User ID or Email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 pl-10 pr-4 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground font-mono">Loading submissions...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-card border border-border rounded-2xl">
            <p className="text-muted-foreground">No submissions found.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map((sub) => (
              <div
                key={sub.id}
                className="bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-all group cursor-pointer"
                onClick={() => handleViewSubmission(sub)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-muted-foreground" />
                      <span className="text-sm font-bold text-foreground">{sub.userEmail || sub.userId}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Award size={14} className="text-primary" />
                      <span className="text-xs font-mono text-muted-foreground">Test: {sub.testId}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-lg font-mono font-black text-primary">{sub.score}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Score</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono text-foreground">
                        {format(sub.completedAt.toDate(), 'dd MMM, HH:mm')}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Completed</div>
                    </div>
                    <div className="p-2 bg-primary/10 text-primary rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      <ExternalLink size={18} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
