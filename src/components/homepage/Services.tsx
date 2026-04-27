import { Link } from "react-router-dom";
import { data } from ".";
import React from "react";

export default function Services(): JSX.Element {
  return (
    <section id="services" className="container mx-auto px-4 lg:px-10 pt-16">
      <h2 className="text-center">Services we provide</h2>
      <div className="grid grid-cols-12 gap-4 md:gap-6 text-white">
        {data?.map((item) => (
          <div
            key={item?.id}
            className="col-span-12 sm:col-span-6 md:col-span-4 lg:col-span-3 relative"
          >
            <div className="flex flex-col items-center bg-primary/80 shadow-gmbf rounded-md p-4 h-full pb-16">
              <h2 className="text-lg md:text-xl lg:text-2xl">{item?.name}</h2>
              <p className="text-center">{item?.description}</p>
              <Link
                to={`/service/${item?.slug}`}
                className="absolute bottom-4 border bg-transparent hover:bg-[#2C3A47] hover:border-[#2C3A47] text-white px-3 py-1 text-center rounded-full shadow-sm shadow-primary transition-all duration-200"
              >
                Learn more
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
