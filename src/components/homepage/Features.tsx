import React from "react";

interface Feature {
  id: number;
  name: string;
  icon: string;
}

export default function Features(): JSX.Element {
  const data: Feature[] = [
    {
      id: 1,
      name: "Friendly Interfaces",
      icon: "features",
    },
    {
      id: 2,
      name: "Highly Parameterized",
      icon: "adjust",
    },
    {
      id: 3,
      name: "Integrated Inter Branch Transaction",
      icon: "transaction",
    },
    {
      id: 4,
      name: "NRB and financial reports",
      icon: "document",
    },
    {
      id: 10,
      name: "GoAml and CIB reports",
      icon: "document",
    },
    {
      id: 5,
      name: "Strong Application Security",
      icon: "shield",
    },
    {
      id: 6,
      name: "Very easy to implement",
      icon: "easy",
    },
    {
      id: 7,
      name: "Real Time Monitoring",
      icon: "database",
    },
    {
      id: 8,
      name: "Dual Date System",
      icon: "calendar",
    },
    {
      id: 9,
      name: "Functional Access Control",
      icon: "lock",
    },
  ];

  return (
    <section className="container mx-auto px-4 lg:px-10 pt-16">
      <header className="text-center">
        <h2>More Features</h2>
        <hr className="w-20 mx-auto" />
        <p className="mt-4">
          We are so excited and proud of our product. It&apos;s really easy and
          feasible for any financial solution.
        </p>
      </header>

      <div className="grid grid-cols-12 text-center">
        {data?.map((item) => (
          <div key={item?.id} className="col-span-6 md:col-span-4 mt-12">
            <img src={`/icons/${item?.icon}.png`} alt={item?.name} className={"h-16 w-16 mx-auto mb-4"} />
            <p className="lead-1">{item?.name}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
