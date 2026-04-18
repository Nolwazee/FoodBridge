import { Button } from '@/components/ui/button';
import { motion } from 'motion/react';
import { useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Mail, MapPin, Phone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function Hero({ onGetStarted }: { onGetStarted: () => void }) {
  const impactSlides = useMemo(
    () => [
      {
        eyebrow: 'CITY HARVEST PROJECT',
        title: '12,000 Meals Provided This Month',
        image:
          'https://images.unsplash.com/photo-1607117362208-ea67f1f5d9c4?auto=format&fit=crop&w=1600&q=70',
      },
      {
        eyebrow: 'BAKERY PARTNERS',
        title: 'Fresh bread and pantry staples redistributed daily',
        image:
          'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=1600&q=70',
      },
    ],
    []
  );
  const [slideIdx, setSlideIdx] = useState(0);

  const [contact, setContact] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'Corporate Donor',
    message: '',
  });

  const onSubmitContact = (e: FormEvent) => {
    e.preventDefault();
    if (!contact.firstName || !contact.lastName || !contact.email || !contact.message) {
      toast.error('Please fill in all fields.');
      return;
    }
    toast.success('Inquiry submitted. We will respond soon.');
    setContact({ firstName: '', lastName: '', email: '', role: 'Corporate Donor', message: '' });
  };

  return (
    <div className="bg-[#F7FAF9]">
      {/* HERO */}
      <section className="relative min-h-[calc(100vh-64px)] flex items-center overflow-hidden bg-[#0A0F0D]">
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
                FoodBridge connects verified retailers with vetted NGOs to redistribute surplus food — reducing waste, fighting hunger, one pickup at a time.
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
      </section>

      {/* IMPACT SHOWCASE */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h2 className="text-4xl font-extrabold text-[#0B1B18] tracking-tight">Abundance, Reallocated.</h2>
              <p className="text-slate-500 mt-3 max-w-2xl">
                See the tangible difference our logistics bridge makes in kitchens across the country.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                className="h-12 w-12 rounded-full bg-white border border-slate-200 hover:bg-slate-50 flex items-center justify-center"
                onClick={() => setSlideIdx((p) => (p - 1 + impactSlides.length) % impactSlides.length)}
                aria-label="Previous"
              >
                <ArrowLeft className="h-5 w-5 text-slate-700" />
              </button>
              <button
                className="h-12 w-12 rounded-full bg-[#0B5D3B] hover:bg-[#084A2F] flex items-center justify-center"
                onClick={() => setSlideIdx((p) => (p + 1) % impactSlides.length)}
                aria-label="Next"
              >
                <ArrowRight className="h-5 w-5 text-white" />
              </button>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-3xl overflow-hidden border border-slate-100 bg-white shadow-sm">
              <div className="relative h-[360px]">
                <img
                  src={impactSlides[slideIdx].image}
                  alt={impactSlides[slideIdx].title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                <div className="absolute left-6 bottom-6">
                  <div className="text-[11px] tracking-widest uppercase text-white/80 font-bold">
                    {impactSlides[slideIdx].eyebrow}
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                    {impactSlides[slideIdx].title}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl overflow-hidden border border-slate-100 bg-white shadow-sm">
                <div className="h-44">
                  <img
                    src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=70"
                    alt="Fresh produce"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
              <div className="rounded-3xl border border-emerald-100 bg-[#0B5D3B] text-white p-8 shadow-sm">
                <div className="text-5xl font-extrabold">45k+</div>
                <div className="text-sm text-white/80 mt-3">
                  Tons of food saved from landfills in 2024 alone.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ARCHITECTURAL LINK */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div className="rounded-3xl overflow-hidden shadow-sm border border-slate-100 bg-white">
              <img
                src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1600&q=70"
                alt="Harvest crates"
                className="w-full h-[420px] object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h2 className="text-4xl font-extrabold text-[#0B5D3B] tracking-tight leading-tight">
                The Architectural Link for <br /> Community Nutrition
              </h2>
              <p className="text-slate-500 mt-5 max-w-xl">
                FoodBridge reimagines the supply chain as a compassionate infrastructure. We don&apos;t just move food; we design systems that eliminate waste at the source and create dignity at the destination.
              </p>

              <div className="mt-8 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center font-extrabold text-emerald-800">
                    A
                  </div>
                  <div>
                    <div className="font-extrabold text-slate-900">Structured Impact</div>
                    <div className="text-sm text-slate-500">
                      Built on transparency and auditable data for every kilogram salvaged.
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center font-extrabold text-blue-800">
                    C
                  </div>
                  <div>
                    <div className="font-extrabold text-slate-900">Community-First</div>
                    <div className="text-sm text-slate-500">
                      Designed around the unique needs of local pantries and shelters.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CONTACT / INQUIRY */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-[40px] border border-slate-100 bg-white shadow-sm p-8 sm:p-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
              <div>
                <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Build a bridge together.</h2>
                <p className="text-slate-500 mt-4 max-w-md">
                  Whether you&apos;re a food retailer, a volunteer, or a corporate donor, we have a seat at the table for you.
                </p>

                <div className="mt-8 space-y-4 text-sm text-slate-600">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-emerald-700" />
                    <span>124 Architecture Row, Metro City, 10012</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-emerald-700" />
                    <span>connect@foodbridge.org</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-emerald-700" />
                    <span>+1 (555) BRIDGE-01</span>
                  </div>
                </div>
              </div>

              <form onSubmit={onSubmitContact} className="bg-slate-50 border border-slate-100 rounded-3xl p-6 sm:p-8 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input
                      value={contact.firstName}
                      onChange={(e) => setContact({ ...contact, firstName: e.target.value })}
                      placeholder="Elena"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input
                      value={contact.lastName}
                      onChange={(e) => setContact({ ...contact, lastName: e.target.value })}
                      placeholder="Rodriguez"
                      className="rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input
                    type="email"
                    value={contact.email}
                    onChange={(e) => setContact({ ...contact, email: e.target.value })}
                    placeholder="elena@example.com"
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label>I am a...</Label>
                  <select
                    value={contact.role}
                    onChange={(e) => setContact({ ...contact, role: e.target.value })}
                    className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                  >
                    <option>Corporate Donor</option>
                    <option>Retailer</option>
                    <option>NGO</option>
                    <option>Volunteer</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Message</Label>
                  <textarea
                    value={contact.message}
                    onChange={(e) => setContact({ ...contact, message: e.target.value })}
                    placeholder="How can we collaborate?"
                    rows={5}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm resize-none"
                  />
                </div>

                <Button className="w-full bg-[#0B5D3B] hover:bg-[#084A2F] text-white rounded-xl h-12 font-extrabold">
                  Submit Inquiry
                </Button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
