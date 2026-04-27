import { Link, useNavigate } from "react-router-dom";
import React, { useState } from "react";
import { useAppContext } from "../../context/state";
import { useAuth } from "../../context/AuthContext";

export default function Header(): JSX.Element {
  const { top } = useAppContext();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const supportPath = user?.role === 'inorins'
    ? '/staff/dashboard'
    : user?.role === 'client'
      ? '/client/tickets'
      : '/login';

  const toggleMobileMenu = () => setMobileOpen((v) => !v);
  const closeMobileMenu = () => setMobileOpen(false);

  const handleNavClick = (sectionId: string) => {
    closeMobileMenu();
    const view = document.querySelector(`#${sectionId}`);
    if (view) {
      view.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      navigate(`/#${sectionId}`);
    }
  };

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        transition: 'all 200ms ease-in-out' 
     
      }}
      className={`w-full ${top ? "bg-gray-100" : "header bg-primary"}`}
    >
      <div className="container flex flex-wrap justify-between items-center mx-auto px-4 lg:px-10">
        <Link to="/" className="flex">
          <img
            src="/inorins.png"
            alt="INORINS LOGO"
            className={`w-full object-contain transition-all duration-200 ease-in-out z-10 ${top ? "h-14" : "h-16"}`}
          />
        </Link>
        <button
          data-collapse-toggle="mobile-menu"
          type="button"
          className="inline-flex items-center p-2 ml-3 text-sm rounded-lg md:hidden text-gray-700 hover:bg-gray-700 outline-none"
          aria-controls="mobile-menu-2"
          aria-expanded="false"
          onClick={toggleMobileMenu}
        >
          <span className="sr-only">Open main menu</span>
          <svg
            className={`w-6 h-6 ${top ? "text-gray-700" : "text-white"}`}
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <div
          className={`${mobileOpen ? 'block' : 'hidden'} fixed left-0 top-0 md:relative w-60 md:block md:w-auto bg-slate-800 md:bg-transparent h-full z-10 transition-all duration-200 ease-linear`}
          id="mobile-menu"
        >
          <button
            data-collapse-toggle="mobile-menu"
            type="button"
            className="md:hidden absolute top-1 right-2"
            aria-controls="mobile-menu-2"
            aria-expanded="false"
            onClick={closeMobileMenu}
          >
            <svg
              className="w-6 h-6 text-gray-300"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <nav className="nav">
            <ul className="flex flex-col mt-8 md:flex-row md:space-x-8 md:mt-0 md:text-sm md:font-medium md:items-center">
              <li>
                <Link
                  to="/"
                  onClick={() => closeMobileMenu()}
                  style={{ color: top ? '#374151' : '#ffffff' }}
                  className={`block py-2 pr-4 pl-3 md:p-0 hover:bg-gray-700 md:hover:bg-transparent border-gray-700 cursor-pointer transition-colors duration-200`}
                  aria-current="page"
                >
                  Home
                </Link>
              </li>
              <li>
                <a
                  onClick={() => handleNavClick("works")}
                  style={{ color: top ? '#374151' : '#ffffff' }}
                  className={`block py-2 pr-4 pl-3 border-b md:border-0 md:p-0 hover:bg-gray-700 md:hover:bg-transparent border-gray-700 cursor-pointer transition-colors duration-200`}
                >
                  What We Do
                </a>
              </li>
              <li>
                <a
                  onClick={() => handleNavClick("about")}
                  style={{ color: top ? '#374151' : '#ffffff' }}
                  className={`block py-2 pr-4 pl-3 border-b md:border-0 md:p-0 hover:bg-gray-700 md:hover:bg-transparent border-gray-700 cursor-pointer transition-colors duration-200`}
                >
                  About Us
                </a>
              </li>
              <li>
                <a
                  onClick={() => handleNavClick("services")}
                  style={{ color: top ? '#374151' : '#ffffff' }}
                  className={`block py-2 pr-4 pl-3 border-b md:border-0 md:p-0 hover:bg-gray-700 md:hover:bg-transparent border-gray-700 cursor-pointer transition-colors duration-200`}
                >
                  Services
                </a>
              </li>
              <li>
                <a
                  onClick={() => handleNavClick("clients")}
                  style={{ color: top ? '#374151' : '#ffffff' }}
                  className={`block py-2 pr-4 pl-3 border-b md:border-0 md:p-0 hover:bg-gray-700 md:hover:bg-transparent border-gray-700 cursor-pointer transition-colors duration-200`}
                >
                  Clients
                </a>
              </li>
              <li>
                <a
                  onClick={() => handleNavClick("contact")}
                  style={{ color: top ? '#374151' : '#ffffff' }}
                  className={`block py-2 pr-4 pl-3 md:border-0 md:p-0 cursor-pointer transition-colors duration-200 ${
                    top 
                      ? "hover:text-gray-900 md:bg-transparent" 
                      : "hover:text-white md:bg-gray-700 md:text-gray-300 md:hover:bg-slate-800 md:rounded-xl md:py-1 md:px-2"
                  }`}
                >
                  Quick Enquiry
                </a>
              </li>
              <li>
                <a
                  onClick={() => { closeMobileMenu(); navigate(supportPath); }}
                  style={{ color: top ? '#374151' : '#ffffff' }}
                  className={`block py-2 pr-4 pl-3 border-b md:border-0 md:p-0 hover:bg-gray-700 md:hover:bg-transparent border-gray-700 cursor-pointer transition-colors duration-200`}
                >
                  Support
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </header>
  );
}
