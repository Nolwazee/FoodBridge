import { Button } from '@/components/ui/button';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';

export default function Hero({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div className="relative min-h-[calc(100vh-64px)] flex items-center overflow-hidden bg-[#0A0F0D]">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=2000" 
          alt="Fresh Vegetables" 
          className="w-full h-full object-cover opacity-40"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 py-20">
        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2D9C75]/20 border border-[#2D9C75]/30 text-[#2D9C75] text-xs font-medium mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2D9C75] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2D9C75]"></span>
              </span>
              Live Redistribution Network
            </div>

            <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-white leading-[1.1] mb-6">
              Bridge the Gap <br />
              <span className="text-[#2D9C75]">Between Surplus</span> <br />
              and Need
            </h1>
            
            <p className="text-lg text-gray-300 mb-10 leading-relaxed max-w-xl">
              FoodBridge connects verified retailers with vetted NGOs to 
              redistribute surplus food — reducing waste, fighting hunger, 
              one pickup at a time.
            </p>

            <div className="flex flex-wrap gap-4 mb-16">
              <Button 
                onClick={onGetStarted} 
                className="bg-[#2D9C75] hover:bg-[#258563] text-white px-8 h-14 text-base font-bold rounded-xl flex items-center gap-2"
              >
                Get Started Free <ArrowRight className="h-5 w-5" />
              </Button>
              <Button 
                variant="outline" 
                onClick={onGetStarted}
                className="bg-white/5 border-white/20 text-white hover:bg-white/10 h-14 px-8 text-base font-bold rounded-xl"
              >
                Sign In
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-12 border-t border-white/10 pt-10">
              <div>
                <div className="text-3xl font-bold text-white mb-1">14,820kg</div>
                <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Food Redistributed</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white mb-1">49,400</div>
                <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Meals Served</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white mb-1">312</div>
                <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Successful Pickups</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
