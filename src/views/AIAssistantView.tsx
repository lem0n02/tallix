import React, { useState, useRef, useEffect } from 'react';
import { Expense } from '../types';
import {
  Sparkles,
  Bot,
  Send,
  User,
  Loader2,
  RotateCcw
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface AIAssistantViewProps {
  expenses: Expense[];
}

interface Message {
  id: string;
  sender: 'copilot' | 'user';
  text: string;
  timestamp: string;
}

const QUICK_ACTIONS = [
  { label: '💰 Save Money', query: 'How can I reduce my monthly expenses and save more money?' },
  { label: '📊 Analyze Spending', query: 'Can you analyze my recent spending and summarize where my money goes?' },
  { label: '🍽️ Budget Meals', query: 'Give me some budget-friendly daily meal ideas that save money.' },
  { label: '🥗 Nutrition Tips', query: 'What are some affordable healthy food choices and basic nutrition tips?' },
  { label: '👥 Shared Expense Help', query: 'How can I split shared group expenses fairly with friends or roommates?' },
  { label: '❓ How to Use Tallix', query: 'How do I use the different features in the Tallix app?' },
];

export const AIAssistantView: React.FC<AIAssistantViewProps> = ({ expenses }) => {
  const { t, formatCurrency } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome_1',
      sender: 'copilot',
      text: "Hi there! I'm your **Tallix AI Copilot** 🤖.\n\nI'm here to help you manage your daily budget, find smart ways to save money, plan budget-friendly meals, split group expenses fairly, and navigate the Tallix app.\n\nHow can I assist you today? Feel free to ask anything or tap one of the suggested quick actions below!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const generateLocalResponse = (queryText: string): string => {
    const q = queryText.toLowerCase();

    // Analyze spending
    if (q.includes('analyze my spending') || q.includes('spending') || q.includes('recent expense') || q.includes('analyze spending')) {
      const totalSpent = expenses.reduce((acc, curr) => acc + curr.amount, 0);
      const categoryTotals: Record<string, number> = {};
      expenses.forEach((e) => {
        categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
      });

      const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];

      return `📊 **Your Recent Spending Breakdown**\n\n` +
        `• **Total Recorded Spending:** ৳${totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n` +
        `• **Total Transactions Logged:** ${expenses.length} items\n` +
        (topCategory ? `• **Highest Spending Category:** ${topCategory[0]} (৳${topCategory[1].toLocaleString()})\n\n` : '\n') +
        `💡 **Smart Advice:** Keep logging your daily micro-purchases! Setting category limits for top spend areas is the fastest way to save 15-20% each month.`;
    }

    // Help save money
    if (q.includes('save money') || q.includes('reduce') || q.includes('budget')) {
      return `💰 **5 Actionable Steps to Save More Money Each Month:**\n\n` +
        `1. **Follow the 50/30/20 Rule:** Allocate 50% of income to essential needs, 30% to personal wants, and 20% directly into savings.\n` +
        `2. **Track Small Daily Leaks:** Daily snacks or coffees can total over ৳3,000/month. Log every single item in Tallix Personal Expenses.\n` +
        `3. **Plan Meals Weekly:** Cooking in bulk cuts food expenses by up to 40% compared to ordering takeaway.\n` +
        `4. **Set a Weekly Liquidity Limit:** Keep a fixed cash/digital balance buffer for discretionary expenses.\n` +
        `5. **Use Tallix Squads:** Always log shared dinners or group trips immediately to ensure fair bill splitting.`;
    }

    // Meal ideas
    if (q.includes('meal') || q.includes('food') || q.includes('recipe') || q.includes('budget meals')) {
      return `🍽️ **Budget-Friendly Meal Plan Ideas:**\n\n` +
        `• **Breakfast:** Egg & Spinach Wrap or Mashed Oats with Bananas & Peanut Butter (~৳60 per serving).\n` +
        `• **Lunch:** Lentil Curry (Dal) + Steamed Rice + Scrambled Egg Salad (~৳90 per serving).\n` +
        `• **Dinner:** Grilled Chicken or Fish Fillet with Roasted Vegetables & Rice (~৳150 per serving).\n\n` +
        `💡 *Pro Tip:* Batch cooking 3-4 days of rice & lentils saves both gas/electricity and food delivery costs!`;
    }

    // Nutrition & calories
    if (q.includes('nutrition') || q.includes('calorie') || q.includes('healthy') || q.includes('nutrition tips')) {
      return `🥗 **Nutrition & Healthy Spending Advice:**\n\n` +
        `• **Focus on High-Density Protein:** Eggs, lentils, chickpeas, peanuts, and cottage cheese give maximum protein per Taka spent.\n` +
        `• **Buy Seasonal Fruits & Greens:** Local seasonal produce is much cheaper and higher in micronutrients than imported goods.\n` +
        `• **Target Daily Intake:** Most adults need ~2,000 kcal/day balanced with complex carbs, healthy fats, and ~60-80g protein.\n` +
        `• **Hydrate Well:** Drink 2.5-3L water daily. Cutting sugary sodas saves ~৳1,200/month while boosting energy!`;
    }

    // Shared expense / Squad tips
    if (q.includes('shared') || q.includes('split') || q.includes('friend') || q.includes('roommate') || q.includes('shared expense help')) {
      return `👥 **Tips for Fair & Effortless Shared Expenses:**\n\n` +
        `1. **Create a Squad in Tallix:** Go to Shared Groups and tap **Create Squad** to get a unique invite code.\n` +
        `2. **Share Invite Code:** Friends can tap **Join Squad** and enter your code (e.g., TLX-KHA-840).\n` +
        `3. **Log Expenses Instantly:** Whenever anyone pays for rent, groceries, or dinner, log the exact paid amount and select split members.\n` +
        `4. **Settle Regularly:** Use bKash or cash to settle balances every week so debt doesn't accumulate!`;
    }

    // How to use Tallix
    if (q.includes('use tallix') || q.includes('feature') || q.includes('app') || q.includes('how to use tallix')) {
      return `❓ **Quick Guide to Tallix Features:**\n\n` +
        `• **Dashboard:** View overall financial liquidity, monthly burn rate, and recent expense feed.\n` +
        `• **Personal Expenses:** Add, edit, filter, or delete your individual receipts and daily expenditures.\n` +
        `• **Shared Groups (Squads):** Split rent, utilities, or outings with friends using unique squad invite codes.\n` +
        `• **Analytics:** View visual pie charts and trends to see which categories take up most of your money.\n` +
        `• **Tallix AI Copilot:** Chat with me anytime for personalized savings guidance, meal ideas, or app support!`;
    }

    // General default friendly answer
    return `🤖 **Tallix AI Copilot Response:**\n\n` +
      `Thank you for asking! Managing your money is all about consistency and awareness.\n\n` +
      `Here is a quick summary for **"${queryText}"**:\n` +
      `• Make sure to record all daily expenses in Tallix to keep your ledger accurate.\n` +
      `• Review your spending weekly in the Analytics tab to identify areas where you can trim unnecessary costs.\n` +
      `• Need specific advice on meal budgeting, saving tips, or shared group expenses? Tap any quick action above!`;
  };

  const handleSendMessage = async (customQuery?: string) => {
    const textToSend = customQuery || inputQuery;
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customQuery) setInputQuery('');
    setLoading(true);

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          contextData: { expensesCount: expenses.length },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.reply) {
          const aiMsg: Message = {
            id: `copilot_${Date.now()}`,
            sender: 'copilot',
            text: data.reply,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages((prev) => [...prev, aiMsg]);
          setLoading(false);
          return;
        }
      }

      // Fallback local intelligent response
      const fallbackText = generateLocalResponse(textToSend);
      setTimeout(() => {
        const aiMsg: Message = {
          id: `copilot_${Date.now()}`,
          sender: 'copilot',
          text: fallbackText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, aiMsg]);
        setLoading(false);
      }, 500);
    } catch (err) {
      console.error('Chat API Error:', err);
      const fallbackText = generateLocalResponse(textToSend);
      setTimeout(() => {
        const aiMsg: Message = {
          id: `copilot_${Date.now()}`,
          sender: 'copilot',
          text: fallbackText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, aiMsg]);
        setLoading(false);
      }, 500);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        sender: 'copilot',
        text: "Chat cleared! How can I help you next? Tap any suggested prompt above or type your query.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-4xl mx-auto w-full px-3 sm:px-6 py-2 sm:py-4 gap-3">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 bg-[#18181b] border border-[#27272a] rounded-xl px-4 py-3 shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-600 p-[1px] shadow-md">
              <div className="w-full h-full bg-[#09090b] rounded-[11px] flex items-center justify-center text-blue-400">
                <Sparkles className="w-4 h-4 animate-pulse" />
              </div>
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#18181b] rounded-full" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-[#fafafa] tracking-tight">{t('aiCopilot')}</h1>
              <span className="text-[10px] font-mono font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded-md">
                Online
              </span>
            </div>
            <p className="text-[11px] text-[#71717a]">
              Financial guide, meal planner & expense assistant
            </p>
          </div>
        </div>

        <button
          onClick={handleClearChat}
          className="px-2.5 py-1.5 bg-[#09090b] border border-[#27272a] hover:border-[#3f3f46] hover:bg-[#27272a] text-[#a1a1aa] hover:text-[#fafafa] rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
          title="Reset conversation"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t('reset')}</span>
        </button>
      </div>

      {/* Quick Action Chips */}
      <div className="shrink-0 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#71717a]">
            Suggested Topics
          </span>
          <span className="text-[10px] text-[#52525b] hidden sm:inline">Click any prompt to ask</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {QUICK_ACTIONS.map((action, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(action.query)}
              disabled={loading}
              className="px-3 py-1.5 bg-[#18181b] hover:bg-[#27272a] active:bg-[#3f3f46] border border-[#27272a] hover:border-[#3f3f46] text-xs font-medium text-[#e4e4e7] hover:text-white rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-sm hover:scale-[1.01] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Box */}
      <div className="flex-1 bg-[#18181b] border border-[#27272a] rounded-2xl flex flex-col min-h-0 overflow-hidden shadow-xl">
        {/* Messages List Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3.5 custom-scrollbar">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${
                msg.sender === 'user' ? 'flex-row-reverse' : ''
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold shadow-sm ${
                  msg.sender === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#09090b] text-emerald-400 border border-[#27272a]'
                }`}
              >
                {msg.sender === 'user' ? (
                  <User className="w-3.5 h-3.5" />
                ) : (
                  <Bot className="w-3.5 h-3.5 text-emerald-400" />
                )}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[88%] sm:max-w-[80%] rounded-xl px-3.5 py-2.5 space-y-1 ${
                  msg.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-none shadow-md shadow-blue-600/10'
                    : 'bg-[#09090b] border border-[#27272a] text-[#f4f4f5] rounded-tl-none shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between gap-3 text-[10px] opacity-70 mb-0.5">
                  <span className="font-bold uppercase tracking-wider">
                    {msg.sender === 'user' ? 'You' : 'Tallix Copilot'}
                  </span>
                  <span className="font-mono">{msg.timestamp}</span>
                </div>
                <div className="text-xs leading-relaxed whitespace-pre-wrap font-sans text-[#e4e4e7]">
                  {msg.text}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#09090b] border border-[#27272a] flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              </div>
              <div className="bg-[#09090b] border border-[#27272a] rounded-xl rounded-tl-none px-3.5 py-2.5 text-xs text-[#a1a1aa] flex items-center gap-2 shadow-sm">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                <span>Formulating response...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Bottom Input Field */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-2.5 sm:p-3 bg-[#121215] border-t border-[#27272a] flex items-center gap-2"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask Copilot... e.g. 'How can I save money on groceries?'"
            className="flex-1 bg-[#09090b] border border-[#27272a] rounded-xl px-3.5 py-2.5 text-xs text-[#fafafa] focus:outline-none focus:border-blue-500 placeholder-[#52525b] transition-all"
          />
          <button
            type="submit"
            disabled={loading || !inputQuery.trim()}
            className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-30 disabled:hover:bg-blue-600 shrink-0 shadow-md shadow-blue-600/20"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Send</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
