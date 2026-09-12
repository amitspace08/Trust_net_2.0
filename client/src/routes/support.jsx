import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../lib/auth";
import { toast } from "sonner";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../components/ui/accordion";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [{ title: "TrustNet - Help & Support" }],
  }),
  component: SupportPage,
});

function SupportPage() {
  const { user } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsg, setChatMsg] = useState("");
  const [chatLog, setChatLog] = useState([
    { role: "agent", text: "Hello! How can the TrustNet Safety Desk assist you today?" }
  ]);
  const chatEndRef = useRef(null);

  // Auto-scroll chat when messages change
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatLog, chatOpen]);

  const handleCall = () => {
    window.location.href = "tel:112";
  };

  const getBotResponse = (msg) => {
    const lowerMsg = msg.toLowerCase();
    if (lowerMsg.includes("help") || lowerMsg.includes("emergency") || lowerMsg.includes("sos")) {
      return "If you are in immediate danger, please close this chat and use the red 'Call 112 Dispatch' button or trigger an SOS immediately.";
    }
    if (lowerMsg.includes("hi") || lowerMsg.includes("hello") || lowerMsg.includes("hey")) {
      return "Hi there! Are you experiencing an issue with your account, or do you have a safety question?";
    }
    if (lowerMsg.includes("account") || lowerMsg.includes("password") || lowerMsg.includes("login")) {
      return "For account-related issues, please navigate to your Profile page where you can manage your details and security.";
    }
    if (lowerMsg.includes("circle") || lowerMsg.includes("friend") || lowerMsg.includes("add")) {
      return "To manage your safety network, head over to the 'Circle' tab. From there you can add Layer 1 contacts and review pending requests.";
    }
    if (lowerMsg.includes("privacy") || lowerMsg.includes("location") || lowerMsg.includes("track")) {
      return "You have full control over your data. Visit the 'Privacy Guard' tab to configure background tracking and data retention rules.";
    }
    return "Thank you for the details. I have forwarded this to our human Safety Desk team. An agent will review and connect with you shortly.";
  };

  const handleSendMsg = (e) => {
    e.preventDefault();
    if (!chatMsg.trim()) return;
    
    const userText = chatMsg;
    const newLog = [...chatLog, { role: "user", text: userText }];
    setChatLog(newLog);
    setChatMsg("");
    
    // Smart Mock response
    setTimeout(() => {
      setChatLog(prev => [...prev, { 
        role: "agent", 
        text: getBotResponse(userText)
      }]);
    }, 1000);
  };

  return (
    <div className="bg-[#faf9fc] text-gray-900 min-h-screen flex flex-col antialiased pb-20 md:pb-0 relative">
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 md:pb-6 flex flex-col gap-6">
        {/* Header */}
        <div className="mb-2">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2 tracking-tight">Help & Support</h1>
          <p className="text-sm text-gray-500 leading-relaxed max-w-2xl">
            Access emergency helplines, review safety walkthroughs, or get in touch with local support teams.
          </p>
        </div>

        {/* Quick Action Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Emergency Card */}
          <div className="bg-red-50 border border-red-100 rounded-2xl p-6 flex flex-col justify-between shadow-sm relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 text-red-500/10 transition-transform group-hover:scale-110">
              <span className="material-symbols-outlined text-9xl">local_police</span>
            </div>
            
            <div className="relative z-10">
              <h3 className="font-bold text-xl text-red-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-red-600">emergency</span> 
                Emergency Services
              </h3>
              <p className="text-sm text-red-700 mt-2 max-w-[85%] leading-relaxed">
                Immediately dial national police and emergency dispatch forces. Use only for active emergencies.
              </p>
            </div>
            
            <button 
              onClick={handleCall}
              className="mt-6 w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm relative z-10 active:scale-[0.98]"
            >
              <span className="material-symbols-outlined">call</span>
              Call 112 Dispatch
            </button>
          </div>

          {/* Support Chat Card */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 flex flex-col justify-between shadow-sm relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 text-indigo-500/10 transition-transform group-hover:scale-110">
              <span className="material-symbols-outlined text-9xl">support_agent</span>
            </div>
            
            <div className="relative z-10">
              <h3 className="font-bold text-xl text-indigo-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600">forum</span> 
                TrustNet Support
              </h3>
              <p className="text-sm text-indigo-700 mt-2 max-w-[85%] leading-relaxed">
                Contact our safety response desk for general account, circle management, or technical assistance.
              </p>
            </div>
            
            <button 
              onClick={() => setChatOpen(true)}
              className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm relative z-10 active:scale-[0.98]"
            >
              <span className="material-symbols-outlined">chat</span>
              Chat with Safety Desk
            </button>
          </div>
        </section>

        {/* FAQs */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mt-2">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-gray-400">help</span>
            Frequently Asked Questions
          </h2>
          
          <Accordion type="single" collapsible className="w-full flex flex-col gap-2">
            <AccordionItem value="item-1" className="border border-gray-100 rounded-xl px-4 data-[state=open]:bg-gray-50 transition-colors">
              <AccordionTrigger className="hover:no-underline font-semibold text-gray-800 text-sm py-4">
                How does the SOS Hold countdown work?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600 leading-relaxed text-sm pb-4">
                The SOS button requires you to press and hold it. A red circle will fill up. Releasing it before 1.5 seconds cancels the trigger. Keeping it held down completes the countdown, immediately triggering an active alert state and notifying your safety circle.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="border border-gray-100 rounded-xl px-4 data-[state=open]:bg-gray-50 transition-colors">
              <AccordionTrigger className="hover:no-underline font-semibold text-gray-800 text-sm py-4">
                What is "Layer 2" inside my safety network?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600 leading-relaxed text-sm pb-4">
                Layer 1 contacts are your direct trusted friends/family. Layer 2 contacts are the trusted guardians added by your Layer 1 contacts (Friends of Friends). In an emergency, if Layer 1 cannot respond, the protocol escalates to Layer 2 guardians nearby to optimize response times.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="border border-gray-100 rounded-xl px-4 data-[state=open]:bg-gray-50 transition-colors">
              <AccordionTrigger className="hover:no-underline font-semibold text-gray-800 text-sm py-4">
                How is my location data handled?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600 leading-relaxed text-sm pb-4">
                TrustNet values privacy. Your location is only sent to your active circle when you start a tracked journey or complete an SOS. All history log files are end-to-end encrypted and can be automatically set to wipe after 7 days in the Privacy Guard tab.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>
      </main>

      {/* Mock Chat Modal Overlay */}
      {chatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col h-[500px] max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-indigo-600 text-white p-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-sm">support_agent</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm">Safety Desk</h3>
                  <p className="text-[10px] text-indigo-200 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span> Online
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setChatOpen(false)}
                className="text-indigo-200 hover:text-white p-1 rounded-full hover:bg-indigo-500 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-gray-50">
              {chatLog.map((log, idx) => (
                <div key={idx} className={`flex ${log.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    log.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-br-none' 
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'
                  }`}>
                    {log.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMsg} className="p-3 bg-white border-t border-gray-100 flex gap-2">
              <input 
                type="text" 
                value={chatMsg}
                onChange={(e) => setChatMsg(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
              <button 
                type="submit"
                disabled={!chatMsg.trim()}
                className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-sm -ml-0.5 mt-0.5">send</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
