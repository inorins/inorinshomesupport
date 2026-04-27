import React, { FormEvent } from "react";

interface TopProps {
  title: string;
  detail: string;
  form: boolean;
}

export default function Top({ title, detail, form }: TopProps): JSX.Element {
  const getStarted = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const emailElement = document.getElementById("email") as HTMLInputElement;
    const email = emailElement?.value;

    // email validation
    if (!email || email.length <= 0) {
      alert("Please enter your email");
      return;
    }

    // email regexp validation
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (emailRegex.test(email)) {
      // email is valid
      try {
        const data = await fetch("/api/subscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        });
        const res = await data.json();
        if (res.success) {
          alert(res.message);
          emailElement.value = "";
        } else {
          alert("Thank you for your subscription");
        }
      } catch (error) {
        alert("Thank you for your subscription");
      }
    } else {
      alert("Invalid email address");
    }
  };

  return (
    <section
      className="pt-40 pb-20 -mt-20 relative h-auto"
      style={{
        background: "#730606 url(/assets/1s.png) no-repeat center center",
        backgroundSize: "cover",
      }}
    >
      <div className="overlay opacity-90 absolute inset-0 h-full w-full bg-primary"></div>
      <div className="container mx-auto px-4 lg:px-10 text-white relative">
        <div className="w-full sm:w-2/3 mx-auto text-center space-y-12">
          <h1 className="xxl:text-6xl">{title}</h1>
          <p className="text-lg">{detail}</p>
          <hr className="w-1/4 mx-auto" />
          {form && (
            <form
              method="POST"
              className="flex flex-wrap justify-between overflow-hidden w-full mx-auto border-2 border-white bg-transparent rounded-full mt-4 md:mt-12"
              onSubmit={getStarted}
            >
              <input
                id="email"
                type="email"
                name="email"
                placeholder="Email Address"
                className="w-2/3 md:w-4/5 p-2 pl-4 outline-none hover:outline-none focus:outline-none border-none bg-transparent text-white placeholder-gray-300"
              />
              <button
                type="submit"
                className="w-1/3 md:w-1/5 p-2 bg-white text-sm md:text-lg font-medium text-[#522EC6] hover:bg-gray-100 transition-colors"
              >
                Get Started
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}