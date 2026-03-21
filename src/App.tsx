import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import HomePage from "./pages/HomePage";
import SetupPage from "./pages/SetupPage";
import TestPage from "./pages/TestPage";
import ResultsPage from "./pages/ResultsPage";
import AnswerKeyPage from "./pages/AnswerKeyPage";
import AnalysisPage from "./pages/AnalysisPage";
import ReviewPage from "./pages/ReviewPage";
import HistoryPage from "./pages/HistoryPage";
import AdminDashboard from "./pages/AdminDashboard";
import CountdownPage from "./pages/CountdownPage";
import PomodoroPage from "./pages/PomodoroPage";
import TodoPage from "./pages/TodoPage";
import NotesPage from "./pages/NotesPage";
import MistakesPage from "./pages/MistakesPage";
import SyllabusPage from "./pages/SyllabusPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

import { AuthProvider } from "./components/AuthProvider";

import CreateTestPage from "./pages/CreateTestPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Pages with sidebar layout */}
            <Route path="/" element={<AppLayout><HomePage /></AppLayout>} />
            <Route path="/omr" element={<AppLayout><SetupPage /></AppLayout>} />
            <Route path="/omr/create" element={<AppLayout><CreateTestPage /></AppLayout>} />
            <Route path="/omr/edit/:testId" element={<AppLayout><CreateTestPage /></AppLayout>} />
            <Route path="/omr/history" element={<AppLayout><HistoryPage /></AppLayout>} />
            <Route path="/countdown" element={<AppLayout><CountdownPage /></AppLayout>} />
            <Route path="/pomodoro" element={<AppLayout><PomodoroPage /></AppLayout>} />
            <Route path="/todos" element={<AppLayout><TodoPage /></AppLayout>} />
            <Route path="/notes" element={<AppLayout><NotesPage /></AppLayout>} />
            <Route path="/mistakes" element={<AppLayout><MistakesPage /></AppLayout>} />
            <Route path="/syllabus" element={<AppLayout><SyllabusPage /></AppLayout>} />
            <Route path="/settings" element={<AppLayout><SettingsPage /></AppLayout>} />
            
            {/* Full-screen pages (no sidebar during test) */}
            <Route path="/test" element={<TestPage />} />
            <Route path="/results" element={<AppLayout><ResultsPage /></AppLayout>} />
            <Route path="/answer-key" element={<AppLayout><AnswerKeyPage /></AppLayout>} />
            <Route path="/analysis" element={<AppLayout><AnalysisPage /></AppLayout>} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/results/submission/:submissionId" element={<AppLayout><ResultsPage /></AppLayout>} />
            <Route path="/admin" element={<AppLayout><AdminDashboard /></AppLayout>} />
            <Route path="/history" element={<AppLayout><HistoryPage /></AppLayout>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
