import React from "react";

export default function About(): JSX.Element {
  return (
    <section className="container mx-auto px-4 lg:px-10 pt-16" id="about">
      <h2 className="text-center">About Us</h2>
      <div className="grid grid-cols-4 lg:grid-cols-12 gap-8 lg:gap-12 items-center bobottom">
        <div className="col-span-4 bg-white shadow-gmbf rounded-md mt-4 p-4">
          <h3>Our Mission</h3>
          <p>Our mission is to make your banking system more convenient</p>
        </div>
        <div className="col-span-4 bg-white shadow-gmbf rounded-md mt-4 p-4">
          <h3>Our Vision</h3>
          <p>
            Our vision is to be one of the top banking service provider of Nepal
          </p>
        </div>
        <div className="col-span-4 bg-white shadow-gmbf rounded-md mt-4 p-4">
          <h3>Our Core Objective</h3>
          <p>
            Our main objective is to help your financial institution grow with
            our services
          </p>
        </div>
      </div>
      <div className="flex flex-col lg:flex-row items-center lg:gap-8 mt-16">
        <div className="w-full lg:w-1/2">
          <div className="box h-96 md:h-80">
            <i className="fas fa-quote-right fa2"></i>
            <div className="text">
              <i className="fas fa-quote-left fa1"></i>
              <div className="px-10 md:px-14 py-7">
                <h2>Message from the CEO</h2>
                <p>
                  Over the past decade, we have strengthened our organization in
                  corporate and financial sector. With the team of experienced
                  and passionate individuals we will be marching towards bigger
                  impact in the financial sector. In our pursuit of greatness,
                  we strive to improve.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex w-full lg:w-1/2 relative overflow-hidden mt-8 lg:mt-0 -ml-4 xl:ml-0">
          <div className="w-48 h-48 xl:w-80 xl:h-80 overflow-hidden -ml-2 xl:ml-0">
            <figure className="w-32 h-32 xl:w-56 xl:h-56 m-8 xl:m-12 bg-[#f6f6f6] rotate-45 overflow-hidden">
              <img
                src="/assets/sir.png"
                className="w-full h-full -rotate-45 object-contain"
                alt="Ramendra Pradhananga"
              />
            </figure>
          </div>
          <div className="w-28 xl:w-48 h-28 xl:h-48 m-10 xl:m-16 absolute bg-white -z-10 border-[6px] xl:border-8 left-4 xl:left-12 rotate-45 border-b-[#2C3A47] border-l-red-700 border-r-[#2C3A47] border-t-red-700"></div>
<h2 className="absolute left-28 xl:left-64 text-xs sm:text-sm xl:text-lg top-2 sm:top-0 xl:top-12 pl-6 xl:pl-20 text-red-700 whitespace-nowrap tracking-tight">
  Ramendra Pradhananga
</h2>          <div
            className="absolute left-28 xl:left-64 top-1/2 bg-[#2C3A47] pr-2 xl:pr-10 pl-16 ml-2 xl:pl-20 w-72 xl:w-96 pt-1 -z-20 border-t-[5px] border-red-700"
            style={{ transform: "translateY(-100%)" }}
          >
            <h3 className=" text-center text-sm sm:text-base xl:text-xl font-semibold xl:font-bold text-gray-200 mb-2">
              CEO <br />
              Inorins Technologies
            </h3>
          </div>
        </div>
      </div>
    </section>
  );
}
