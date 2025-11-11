import React, { forwardRef, useState } from 'react'
import { Dialog, DialogPanel } from '@headlessui/react'
import {
  Bars3Icon,
  XMarkIcon,
  InformationCircleIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline'
import { motion, useReducedMotion } from 'framer-motion' // 🪄 import motion

function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}

const navigation = [
  { name: 'About Us', href: '#', icon: InformationCircleIcon },
  { name: 'Contact', href: '#', icon: PhoneIcon },
]

const MotionLink = motion.a // 🪄 make motion-enabled anchor

const Header = forwardRef(function Header(_, ref) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  const hoverScale = prefersReducedMotion ? 1 : 1.05
  const tapScale = prefersReducedMotion ? 1 : 0.97

  return (
    <header
      ref={ref}
      className={classNames(
        'sticky top-0 z-50',
        'backdrop-blur',
        'bg-white/80 supports-backdrop-blur:bg-white/60',
        'shadow-md border-b border-black/5'
      )}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between p-6 lg:px-8">
        <h1 className="text-3xl font-bold" style={{ fontFamily: "'My Soul', cursive" }}>
          Stories By ARK
        </h1>

        {/* Mobile Menu Button */}
        <div className="flex lg:hidden">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-700"
          >
            <span className="sr-only">Open main menu</span>
            <Bars3Icon className="size-6" />
          </button>
        </div>

        {/* Desktop Nav with Animation */}
        <div className="hidden lg:flex lg:gap-x-8">
          {navigation.map((item) => (
            <MotionLink
              key={item.name}
              href={item.href}
              whileHover={{ scale: hoverScale }}
              whileTap={{ scale: tapScale }}
              transition={{ type: 'spring', stiffness: 350, damping: 22 }}
              className={classNames(
                'text-gray-500 hover:text-gray-700',
                'group inline-flex items-center px-1 py-2 text-sm font-medium transition-colors duration-200 rounded-md'
              )}
            >
              <item.icon
                aria-hidden="true"
                className={classNames(
                  'text-gray-400 group-hover:text-gray-500',
                  'mr-2 -ml-0.5 size-5 transition-colors duration-200'
                )}
              />
              {item.name}
            </MotionLink>
          ))}
        </div>
      </nav>

      {/* Mobile Menu */}
      <Dialog open={mobileMenuOpen} onClose={setMobileMenuOpen} className="lg:hidden">
        <div className="fixed inset-0 z-50" />
        <DialogPanel className="fixed inset-y-0 right-0 z-[60] w-full overflow-y-auto bg-white p-6 sm:max-w-sm sm:ring-1 sm:ring-gray-900/10">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold" style={{ fontFamily: "'My Soul', cursive" }}>
              The Arroju&apos;s
            </h1>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="-m-2.5 rounded-md p-2.5 text-gray-700"
            >
              <XMarkIcon className="size-6" />
            </button>
          </div>

          <div className="mt-6">
            <div className="space-y-2 py-6">
              {navigation.map((item) => (
                <motion.a
                  key={item.name}
                  href={item.href}
                  whileHover={{ scale: hoverScale }}
                  whileTap={{ scale: tapScale }}
                  transition={{ type: 'spring', stiffness: 350, damping: 22 }}
                  onClick={() => setMobileMenuOpen(false)}
                  className={classNames(
                    'text-gray-900 hover:bg-gray-50',
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-base font-semibold transition-colors duration-200'
                  )}
                >
                  <item.icon
                    aria-hidden="true"
                    className="size-5 text-gray-400"
                  />
                  {item.name}
                </motion.a>
              ))}
            </div>
          </div>
        </DialogPanel>
      </Dialog>
    </header>
  )
})

export default Header;