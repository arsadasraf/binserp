"use client";

import Link from "next/link";
import Image from "next/image";
import Navbar from "@/src/components/Navbar";
import Footer from "@/src/components/Footer";
import { motion } from "framer-motion";
import { ArrowRight, BarChart2, Cpu, Users, Zap, Shield, Globe, MessageCircle } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden">
      <Navbar />

      {/* Hero Section */}
      <section className="relative min-h-[90vh] pt-28 md:pt-0 flex items-center justify-center bg-gradient-to-br from-indigo-900 via-violet-900 to-slate-900 overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid.svg')] opacity-10"></div>
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 8, repeat: Infinity }}
            className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-500 rounded-full blur-[128px] opacity-30"
          />
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{ duration: 10, repeat: Infinity, delay: 2 }}
            className="absolute bottom-0 right-0 w-[40rem] h-[40rem] bg-violet-600 rounded-full blur-[150px] opacity-30"
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="inline-block py-1 px-3 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-sm font-medium mb-6 backdrop-blur-sm">
              🚀 The Future of Manufacturing ERP
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight mb-8 leading-tight">
              Manage Your Factory <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
                Like a Pro with BinsErp
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-indigo-100/80 max-w-3xl mx-auto mb-10 leading-relaxed">
              Seamlessly integrate machines, manpower, and materials.
              The intelligent ERP built specifically for modern manufacturing.
            </p>

            <div className="flex flex-col sm:flex-row gap-5 justify-center items-center">
              <Link href="/register">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-bold text-lg shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:shadow-[0_0_30px_rgba(79,70,229,0.6)] transition-all flex items-center gap-2"
                >
                  Get Started <ArrowRight size={20} />
                </motion.button>
              </Link>
              <Link href="/login">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 bg-transparent border border-white/20 text-white rounded-full font-semibold text-lg hover:bg-white/10 backdrop-blur-sm transition-all"
                >
                  Login to Dashboard
                </motion.button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 relative overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/features-bg.png"
            alt="Features Background"
            fill
            className="object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/50 to-white/90 backdrop-blur-[2px]"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6 drop-shadow-sm">
              Complete Control at Your Fingertips
            </h2>
            <p className="text-xl text-gray-700 max-w-2xl mx-auto font-medium">
              BinsErp provides 360-degree visibility into your manufacturing operations.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              image="/features/monitor.png"
              icon={<Cpu size={24} />}
              title="Smart Machine Monitoring"
              description="Real-time tracking of machine health, downtime analytics, and maintenance scheduling to maximize OEE."
              color="text-white"
              bg="bg-blue-600"
            />
            <FeatureCard
              image="/features/workforce.png"
              icon={<Users size={24} />}
              title="Workforce Management"
              description="Streamline attendance, shift planning, and performance tracking. Assign tasks effectively."
              color="text-white"
              bg="bg-purple-600"
            />
            <FeatureCard
              image="/features/analytics.png"
              icon={<BarChart2 size={24} />}
              title="Advanced Analytics"
              description="Make data-driven decisions with powerful dashboards. Visualize production trends instantly."
              color="text-white"
              bg="bg-emerald-600"
            />
            <FeatureCard
              image="/features/production.png"
              icon={<Zap size={24} />}
              title="Production Planning"
              description="Optimize workflows, manage job orders, and track inventory flow from raw material to dispatch."
              color="text-white"
              bg="bg-amber-600"
            />
            <FeatureCard
              image="/features/security.png"
              icon={<Shield size={24} />}
              title="Secure & Reliable"
              description="Enterprise-grade security for your data with automated backups and role-based access control."
              color="text-white"
              bg="bg-red-600"
            />
            <FeatureCard
              image="/features/cloud.png"
              icon={<Globe size={24} />}
              title="Cloud Accessibility"
              description="Access your ERP from anywhere, anytime. Stay connected to your factory floor on the go."
              color="text-white"
              bg="bg-cyan-600"
            />
          </div>
        </div>
      </section>

      {/* CTA Band */}
      <section className="py-20 bg-indigo-900 border-t border-indigo-800">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Transform Your Manufacturing Business Today
          </h2>
          <p className="text-indigo-200 text-lg mb-10 max-w-2xl mx-auto">
            Join the revolution. Say goodbye to spreadsheets and hello to intelligent automation with BinsErp.
            Contact us on WhatsApp to get your company onboarded — we&apos;ll set everything up for you!
          </p>
          <Link href="/register">
            <button className="inline-flex items-center gap-3 px-10 py-4 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl font-bold text-xl shadow-2xl hover:scale-105 transition-transform">
              Start Your Journey <ArrowRight size={24} />
            </button>
          </Link>
          <p className="text-indigo-400 text-sm mt-4">📞 +91 7483143810 &nbsp;|&nbsp; Mon–Sat, 9am–6pm</p>
        </div>
      </section>

      <Footer />
    </div>
  );
}

// Feature Card Component
function FeatureCard({ image, icon, title, description, color, bg }: any) {
  return (
    <motion.div
      whileHover={{ y: -10 }}
      className="group bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 overflow-hidden hover:shadow-2xl transition-all hover:bg-white/90 flex flex-col h-full"
    >
      <div className="relative h-48 w-full overflow-hidden">
        <Image
          src={image}
          alt={title}
          fill
          className="object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <p className="text-white font-medium text-sm">Explore Feature</p>
        </div>
      </div>

      <div className="p-8 flex-1 flex flex-col">
        <div className={`w-12 h-12 ${bg} ${color} rounded-xl flex items-center justify-center mb-6 shadow-md`}>
          {icon}
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-3">{title}</h3>
        <p className="text-gray-600 leading-relaxed">
          {description}
        </p>
      </div>
    </motion.div>
  );
}
