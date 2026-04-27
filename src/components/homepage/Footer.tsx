import React from "react";
import { Facebook, Linkedin, Mail } from "lucide-react";
import { useAppContext } from "../../context/state";

export default function Footer(): JSX.Element {
  const { top } = useAppContext();
  
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <footer className="bg-gray-100 py-4 overflow-x-hidden">
      <div className="container mx-auto px-4 lg:px-10">
        <div className="grid grid-cols-12 gap-8 md:py-4">
          <div className="col-span-12 md:col-span-4 lg:col-span-3 mt-8 md:mt-0">
            <h5 className="text-xl font-bold sm:text-center md:text-left">
              Call Us
            </h5>
            <a href="tel:015453734" className="font-medium block mt-1">
              01 5453734
            </a>
          </div>
          <div className="col-span-12 md:col-span-4 lg:col-span-3 mt-8 md:mt-0">
            <h5 className="text-xl font-bold sm:text-center md:text-left">
              Email Us
            </h5>
            <a
              href="mailto:infoinorinscbs@gmail.com"
              className="font-medium block mt-1"
            >
              infoinorinscbs@gmail.com
            </a>
            <a
              href="mailto:inorinsttechcbs@gmail.com"
              className="font-medium block mt-1"
            >
              inorinsttechcbs@gmail.com
            </a>
          </div>
          <div className="col-span-12 md:col-span-4 lg:col-span-3 mt-8 md:mt-0">
            <h5 className="text-xl font-bold sm:text-center md:text-left">
              Contact Address
            </h5>
            <address className="not-italic mb-4 font-medium">
              GM Complex, Lagankhel
              <br />
              Lalitpur, Nepal
            </address>
          </div>
          <div className="col-span-12 md:col-span-4 lg:col-span-3 mt-8 md:mt-0">
            <div className="social">
              <h5 className="text-xl font-bold sm:text-center md:text-left">
                Stay connected
              </h5>
              <div className="flex sm:justify-center md:justify-start space-x-3">
                <a
                  href="https://www.facebook.com/InorinsTech"
                  target="_blank"
                  rel="noreferrer"
                  className="w-9 h-9 border-2 border-gray-400 rounded-full flex items-center justify-center text-gray-600 hover:text-white hover:bg-blue-600 hover:border-blue-600"
                >
                  <Facebook className="w-4 h-4" />
                </a>
                <a
                  href="https://www.linkedin.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="w-9 h-9 border-2 border-gray-400 rounded-full flex items-center justify-center text-gray-600 hover:text-white hover:bg-blue-700 hover:border-blue-700"
                >
                  <Linkedin className="w-4 h-4" />
                </a>
                <a
                  href="mailto:inorinsttechcbs@gmail.com"
                  className="w-9 h-9 border-2 border-gray-400 rounded-full flex items-center justify-center text-gray-600 hover:text-white hover:bg-red-600 hover:border-red-600"
                >
                  <Mail className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t-2 border-gray-600 mt-6 ">
        <div className="container mx-auto px-4 lg:px-10 md:flex md:flex-wrap md:-mx-4 pt-6 md:pt-12 justify-between items-center">
          <div className="w-full px-4 md:w-1/6">
            <img
              src="/inorins.png"
              alt="Inorins Logo"
              className="mx-auto md:mx-0"
            />
          </div>
          <div className="mt-4 md:mt-0 text-center font-medium">
            <p>Copyright &copy; Inorins Technologies Pvt. Ltd.</p>
            <p className="mb-0">All Rights Reserved</p>
          </div>
        </div>
      </div>

      <div
        className={`bg-primary/90 text-white cursor-pointer z-10 px-4 shadow-gmbf shadow-primary/80 py-1 rounded-full font-semibold fixed bottom-10 right-2 ${
          top ? "" : "hidden"
        }`}
        onClick={scrollToTop}
      >
        GO TO TOP
      </div>
    </footer>
  );
}
