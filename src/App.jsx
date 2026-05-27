// App.jsx — public fan view entry point
// No login required. FanApp handles its own optional auth for subscriptions.
import FanApp from './FanApp'
export default function App({ deepHandle }) {
  return <FanApp deepHandle={deepHandle} />
}
