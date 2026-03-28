import { useEffect } from 'react'
import { Outlet, useLocation, useNavigation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'
import { Navbar } from './Navbar'

NProgress.configure({ showSpinner: false, speed: 300 })

export function Layout() {
  const navigation = useNavigation()
  const location = useLocation()

  useEffect(() => {
    if (navigation.state === 'loading') {
      NProgress.start()
    } else {
      NProgress.done()
    }
  }, [navigation.state])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
