import React, { forwardRef, useState } from 'react'
import { Dialog, DialogPanel } from '@headlessui/react'
import {
    Bars3Icon,
    XMarkIcon,
    PhotoIcon,
    Squares2X2Icon,
    ChatBubbleLeftRightIcon,
    UserCircleIcon,
} from '@heroicons/react/24/outline'
import { Link, useLocation } from 'react-router-dom'

function classNames(...classes) {
    return classes.filter(Boolean).join(' ')
}

const navigation = [
    { name: 'Carousel', href: '/admin/carousel', icon: PhotoIcon },
    { name: 'Masonry', href: '/admin/masonry', icon: Squares2X2Icon },
    { name: 'Testimonials', href: '/admin/testimonials', icon: ChatBubbleLeftRightIcon },
    { name: 'Profile', href: '/admin', icon: UserCircleIcon },
]

const AdminHeader = forwardRef(function Header(_, ref) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const location = useLocation()

    return (
        <header ref={ref} className="bg-white w-full z-50 shadow-md">
            <nav className="mx-auto flex max-w-7xl items-center justify-between p-6 lg:px-8">
                <h1 className="text-3xl font-bold" style={{ fontFamily: "'My Soul', cursive" }}>
                    The Arroju's
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

                {/* Desktop Nav */}
                <div className="hidden lg:flex lg:gap-x-8">
                    {navigation.map((tab) => {
                        const isActive = location.pathname === tab.href
                        return (
                            <Link
                                key={tab.name}
                                to={tab.href}
                                aria-current={isActive ? 'page' : undefined}
                                className={classNames(
                                    isActive
                                        ? 'text-indigo-600'
                                        : 'text-gray-500 hover:text-gray-700',
                                    'group inline-flex items-center px-1 py-2 text-sm font-medium transition-colors duration-200'
                                )}
                            >
                                <tab.icon
                                    aria-hidden="true"
                                    className={classNames(
                                        isActive
                                            ? 'text-indigo-500'
                                            : 'text-gray-400 group-hover:text-gray-500',
                                        'mr-2 -ml-0.5 size-5 transition-colors duration-200'
                                    )}
                                />
                                {tab.name}
                            </Link>
                        )
                    })}
                </div>
            </nav>

            {/* Mobile Menu */}
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
                            {navigation.map((tab) => {
                                const isActive = location.pathname === tab.href
                                return (
                                    <Link
                                        key={tab.name}
                                        to={tab.href}
                                        onClick={() => setMobileMenuOpen(false)}
                                        aria-current={isActive ? 'page' : undefined}
                                        className={classNames(
                                            isActive
                                                ? 'text-indigo-600 bg-gray-100'
                                                : 'text-gray-900 hover:bg-gray-50',
                                            'flex items-center gap-3 rounded-lg px-3 py-2 text-base font-semibold transition-colors duration-200'
                                        )}
                                    >
                                        <tab.icon
                                            aria-hidden="true"
                                            className={classNames(
                                                isActive
                                                    ? 'text-indigo-500'
                                                    : 'text-gray-400 group-hover:text-gray-500',
                                                'size-5 transition-colors duration-200'
                                            )}
                                        />
                                        {tab.name}
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                </DialogPanel>
            </Dialog>
        </header>
    )
})

export default AdminHeader