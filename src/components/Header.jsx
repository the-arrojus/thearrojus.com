import React, { forwardRef } from 'react'
import { useState } from 'react'
import { Dialog, DialogPanel } from '@headlessui/react'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'

const navigation = [
    { name: 'Blog', href: '#' },
    { name: 'Our Work', href: '#' },
    { name: 'About Us', href: '#' },
    { name: 'Contact', href: '#' },
]

const Header = forwardRef(function Header(_, ref) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    return (
        <header ref={ref} className="bg-white w-full z-50 shadow-md">
            <nav className="mx-auto flex max-w-7xl items-center justify-between p-6 lg:px-8">
                <h1 className="text-3xl font-bold" style={{ fontFamily: "'My Soul', cursive" }}>
                    The Arroju's
                </h1>
                <div className="flex lg:hidden">
                    <button
                        onClick={() => setMobileMenuOpen(true)}
                        className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-700"
                    >
                        <span className="sr-only">Open main menu</span>
                        <Bars3Icon className="size-6" />
                    </button>
                </div>
                <div className="hidden lg:flex lg:gap-x-12">
                    {navigation.map((item) => (
                        <a
                            key={item.name}
                            href={item.href}
                            className="text-sm/6 font-semibold text-gray-900"
                        >
                            {item.name}
                        </a>
                    ))}
                </div>
            </nav>
            <Dialog open={mobileMenuOpen} onClose={setMobileMenuOpen} className="lg:hidden">
                <div className="fixed inset-0 z-50" />
                <DialogPanel className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white p-6 sm:max-w-sm sm:ring-1 sm:ring-gray-900/10">
                    <div className="flex items-center justify-between">
                        <h1 className="text-3xl font-bold" style={{ fontFamily: "'My Soul', cursive" }}>
                            The Arroju's
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
                                <a
                                    key={item.name}
                                    href={item.href}
                                    className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold text-gray-900 hover:bg-gray-50"
                                >
                                    {item.name}
                                </a>
                            ))}
                        </div>
                    </div>
                </DialogPanel>
            </Dialog>
        </header>
    )
})

export default Header
