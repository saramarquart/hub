import type { Metadata } from 'next';
import ThemeToggle from '../ThemeToggle';
import CommodityTracker from './CommodityTracker';

export const metadata: Metadata = {
  title: 'paf_commodity',
  description:
    'Daily cocoa & FX prices for chocolate inputs, a live cocoa chart, and the Cost Crunch COGS calculator.',
  icons: {
    icon: [{ url: '/icons/paf-commodity.svg', type: 'image/svg+xml' }],
  },
};

/**
 * Commodity Tracker route. This server component just frames the page; all live
 * data (fetching commodities.json, FX conversion, the editable Cost Crunch
 * calculator, the charts) runs client-side in <CommodityTracker/> so the whole
 * thing is static-export safe.
 */
export default function CommodityTrackerPage() {
  return (
    <>
      <div className="bg-orbs" aria-hidden="true" />
      <ThemeToggle />
      <CommodityTracker />
    </>
  );
}
