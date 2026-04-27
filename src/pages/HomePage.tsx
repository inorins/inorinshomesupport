import React, { useState } from "react";
import { AppWrapper } from "@/context/state";
import Layout from "@/components/homepage/Layout";
import Top from "@/components/homepage/Top";
import About from "@/components/homepage/About";
import Services from "@/components/homepage/Services";
import Features from "@/components/homepage/Features";
import Clients from "@/components/homepage/Clients";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

export default function HomePage() {
  const [toggle, setToggle] = useState(true);

  return (
    <AppWrapper>
      <div className="homepage pt-24">
        <Layout>
          <Top
            title="Welcome to Inorins Technologies"
            detail="One of the best Core Banking System and financial service provider in Nepal."
            form={false}
          />

          <section className="container mt-2 mx-auto px-4 lg:px-10 pt-16" id="works">
            <h2 className="text-center">What We Do</h2>
            <h3 className="text-center">Designed for Financial Solution</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="col-span-1 text-justify">
                <p>
                  Inorins Technologies (P) Limited is an established software
                  company aiming to provide world class IT solutions for enterprise
                  sectors in Nepal. The company is promoted by more than 20 Bankers
                  and IT Professionals having experiences in designing, developing
                  and implementing Banking Systems, Financial Systems and Enterprise
                  Resource Planning (ERPs).
                </p>
                <p
                  className={`overflow-y-hidden transition-all duration-300 ${
                    toggle ? "h-24" : "h-full max-h-[17rem]"
                  }`}
                >
                  Inorins Technologies is registered at GoN/Ministry of Industry,
                  Office of the Company Registrar in January 16, 2011, as a Limited
                  Liability Company. Currently its authorized capital is Rs 20
                  Million, issued capital Rs 12 Million. Further, for the stability
                  of the company, we have put aside some portion of our share to our
                  valued customers as well as for knowledgeable employees willing to
                  serve the company for longer periods. As our first service to the
                  Banks and Financial Institutions in Nepal, we have developed
                  integrated core banking system named Banquier to fulfill the needs
                  of BFIs. The system not only allows the BFIs to provide the
                  traditional banking services and newer emerging value added
                  services efficiently, but allows the enterprises to implement its
                  control measures and policies to minimize operational risks.
                </p>
                <button
                  className="ml-auto block mt-4 text-blue-400 hover:text-blue-700"
                  onClick={() => setToggle(!toggle)}
                  title={toggle ? "Read More" : "Read Less"}
                >
                  {toggle ? "Read More" : "Read Less"}
                </button>
              </div>
              <div className="col-span-1 flex flex-wrap justify-center items-center">
                <div className="pie" style={{ "--p": 80 } as React.CSSProperties}>
                  <span className="block text-2xl font-semibold mb-2">80 %</span>
                  <span className="font-medium">Core Banking System</span>
                </div>
                <div className="pie" style={{ "--p": 15 } as React.CSSProperties}>
                  <span className="block text-2xl font-semibold mb-2">15 %</span>
                  <span className="font-medium">Mobile App Development</span>
                </div>
                <div className="pie" style={{ "--p": 5 } as React.CSSProperties}>
                  <span className="block text-2xl font-semibold mb-2">5 %</span>
                  <span className="font-medium">Web Development</span>
                </div>
              </div>
            </div>
          </section>

          <About />
          <Services />
          <Features />

          <section className="container mx-auto px-4 lg:px-10 pt-16" id="clients">
            <h2 className="text-center mb-6">Our Clients</h2>
            <Clients />
          </section>

          <section className="background py-20 mt-16" id="contact">
            <h2 className="text-center text-white mb-10 relative">Contact Us</h2>
            <div className="container h-72 mx-auto px-4 lg:px-10 grid grid-cols-1 gap-8">
              <div className="col-span-1">
                <iframe
                  className="w-full h-full lg:pr-4"
                  title="Inorins Technologies"
                  src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d4202.268810552202!2d85.31859964936794!3d27.66559618971678!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39eb1995436e3273%3A0x47a19238ba8dc8fa!2sInorins%20Technologies!5e0!3m2!1sen!2snp!4v1648107321016!5m2!1sen!2snp"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            </div>
          </section>
        </Layout>
      </div>
    </AppWrapper>
  );
}
