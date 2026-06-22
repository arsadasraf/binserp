"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import Navbar from "@/src/components/Navbar";
import Footer from "@/src/components/Footer";
import { Award, Target, Zap, Users, Globe, ShieldCheck } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden">
      <Navbar />

      {/* Hero Section */}
      <section className="relative h-[60vh] flex items-center justify-center bg-gradient-to-br from-indigo-900 to-violet-900 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 10, repeat: Infinity }}
          className="absolute top-0 right-0 w-[30rem] h-[30rem] bg-indigo-500 rounded-full blur-[100px] opacity-20"
        />

        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block py-1 px-3 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-sm font-medium mb-4 backdrop-blur-sm"
          >
            About BinsErp
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-bold mb-6 text-white tracking-tight"
          >
            Revolutionizing Manufacturing with Intelligent ERP
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-xl text-indigo-100 max-w-2xl mx-auto leading-relaxed"
          >
            We bridge the gap between machines, manpower, and management to create smarter, more efficient factories.
          </motion.p>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-sm font-bold text-indigo-600 tracking-widest uppercase mb-2">Our Mission</h2>
            <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Building the Operating System for Modern Factories
            </h3>
            <p className="text-lg text-gray-600 mb-6 leading-relaxed">
              BinsErp was born from a simple observation: manufacturing is complex, but managing it shouldn't be.
              We saw factories struggling with siloed data, disconnected machines, and manual spreadsheets.
            </p>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              Our mission is to empower every manufacturer—from small workshops to large enterprises—with
              AI-driven insights that drive efficiency, reduce waste, and boost profitability.
            </p>

            <div className="grid grid-cols-2 gap-6">
              <Stat number="500+" label="Factories Optimized" />
              <Stat number="98%" label="Efficiency Gain" />
              <Stat number="24/7" label="Real-time Monitoring" />
              <Stat number="10M+" label="Data Points Analyzed" />
            </div>
          </motion.div>

          {/* Placeholder for a team or office image - using a gradient box for now */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative h-[500px] rounded-2xl overflow-hidden shadow-2xl"
          >
            <Image
              src="/connecting-factories.png"
              alt="Connecting Factories Globally"
              fill
              className="object-cover hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/80 via-transparent to-transparent flex items-end p-8">
              <div className="text-white">
                <Globe size={32} className="mb-2 opacity-90" />
                <p className="text-xl font-bold">Connecting Factories Globally</p>
                <p className="text-indigo-200 text-sm">Seamless manufacturing network</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Why Choose BinsErp?</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Built by engineers, for engineers. We understand the unique challenges of the manufacturing floor.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <ValueCard
              icon={<Target className="text-indigo-600" size={32} />}
              title="Precision First"
              description="Accuracy is non-negotiable. Our algorithms ensure your inventory and production data is always spot-on."
            />
            <ValueCard
              icon={<Zap className="text-amber-500" size={32} />}
              title="Real-time Speed"
              description="Decisions can't wait. Get live updates from your shop floor instantly, anywhere in the world."
            />
            <ValueCard
              icon={<ShieldCheck className="text-emerald-600" size={32} />}
              title="Enterprise Security"
              description="Your proprietary data is safe with us. We use bank-grade encryption and strict access controls."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-indigo-900 text-white text-center">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Ready to transform your factory?</h2>
          <p className="text-xl text-indigo-200 mb-10">
            Join the hundreds of manufacturers who have switched to BinsErp.
          </p>
          <button className="px-8 py-4 bg-white text-indigo-900 rounded-full font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg">
            Get Started Today
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <div className="text-3xl font-bold text-indigo-600">{number}</div>
      <div className="text-sm text-gray-500 font-medium">{label}</div>
    </div>
  );
}

function ValueCard({ icon, title, description }: any) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl transition-all"
    >
      <div className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-3">{title}</h3>
      <p className="text-gray-600 leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
}
