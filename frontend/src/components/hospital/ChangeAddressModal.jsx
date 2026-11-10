import { useState } from 'react'
import { MapPin, LocateFixed, X, Check, Navigation } from 'lucide-react'
import { TextInput, Banner } from '../common/FormControls.jsx'
import AddressAutocomplete from '../common/AddressAutocomplete.jsx'
import HospitalMap from '../common/HospitalMap.jsx'
import { ToolButton } from './ui.jsx'
import { getCurrentPosition, geocodeAddress, reverseGeocode } from '../../lib/geo.js'

/**
 * Map-first address picker for a hospital — the same two ways a patient sets
 * their location: search Google Maps, or drop on the device's current position.
 *
 * The hospital address is the source of truth for every doctor practising there,
 * so this saves through the parent (`onConfirm`) rather than letting the page
 * hold half-applied coordinates: pick -> confirm -> one PUT that also re-points
 * the doctors' hospital locations.
 */
export default function ChangeAddressModal({ hospital, onClose, onConfirm }) {
  const [addr, setAddr] = useState({
    address: hospital.address || '',
    city: hospital.city || '',
    state: hospital.state || '',
    pincode: hospital.pincode || '',
    latitude: hospital.latitude ?? null,
    longitude: hospital.longitude ?? null,
  })
  const [busy, setBusy] = useState(null)   // 'locating' | 'searching' | 'saving'
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const set = (k) => (e) => setAddr((a) => ({ ...a, [k]: e.target.value }))
  const pinned = addr.latitude != null && addr.longitude != null

  // Drop the pin on the device's position, then name it.
  const useCurrentLocation = async () => {
    setBusy('locating')
    setError(null)
    try {
      const { lat, lng } = await getCurrentPosition()
      const place = await reverseGeocode(lat, lng)
      setAddr((a) => ({
        ...a,
        latitude: lat,
        longitude: lng,
        address: place?.label || a.address,
        city: place?.city || a.city,
        state: place?.state || a.state,
        pincode: place?.pincode || a.pincode,
      }))
      if (!place) setError('Pin dropped, but we couldn’t name the address — please type it below.')
    } catch (e) {
      setError(e.message || 'Could not get your location.')
    } finally {
      setBusy(null)
    }
  }

  // For a typed address that was never picked from the dropdown.
  const locateTypedAddress = async () => {
    if (!addr.address.trim()) { setError('Enter or search an address first.'); return }
    setBusy('searching')
    setError(null)
    try {
      const g = await geocodeAddress(addr)
      if (!g) { setError('Couldn’t find that address on the map. Try picking it from the search suggestions.'); return }
      // Only the city matched — pinning its centre put a KPHB hospital by
      // Charminar, 15 km away, and every patient's travel time with it.
      if (g.approximate) {
        setError('Only the city was found for this address, so the pin would be far from the hospital. Pick the address from the search suggestions, or use your current location at the hospital.')
        return
      }
      setAddr((a) => ({ ...a, latitude: g.lat, longitude: g.lng }))
    } catch (e) {
      setError(e.message || 'Address lookup failed.')
    } finally {
      setBusy(null)
    }
  }

  const confirm = async () => {
    if (!addr.address.trim()) { setError('Enter or search an address first.'); return }
    setSaving(true)
    setError(null)
    try {
      // A hospital with no pin gets no travel times, so resolve one last time
      // before saving rather than storing an address with no coordinates.
      let { latitude, longitude } = addr
      if (latitude == null || longitude == null) {
        const g = await geocodeAddress(addr).catch(() => null)
        // A city-level guess is not saved as the hospital's location.
        if (g && !g.approximate) { latitude = g.lat; longitude = g.lng }
      }
      await onConfirm({ ...addr, latitude, longitude })
    } catch (e) {
      setError(e.message || 'Could not save the address.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[17px] font-bold text-brand-navy">Change Hospital Address</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-4 text-[13.5px] text-slate-500">
          Search for your hospital or use your current location. Every doctor practising here gets the
          new address, and patients see it on search and booking.
        </p>

        {error && <div className="mb-4"><Banner type="error">{error}</Banner></div>}

        <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">Search on Google Maps</label>
        <AddressAutocomplete
          value={addr.address}
          onChange={(val) => setAddr((a) => ({ ...a, address: val, latitude: null, longitude: null }))}
          onSelect={(p) => setAddr((a) => ({
            ...a,
            address: p.label || a.address,
            city: p.city || a.city,
            state: p.state || a.state,
            pincode: p.pincode || a.pincode,
            latitude: p.lat ?? a.latitude,
            longitude: p.lng ?? a.longitude,
          }))}
          biasLat={Number(addr.latitude) || undefined}
          biasLng={Number(addr.longitude) || undefined}
          placeholder="Hospital name, street, landmark…"
          className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-9 text-sm text-brand-navy outline-none transition-colors focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={!!busy || saving}
            className="inline-flex items-center gap-2 rounded-xl border border-brand-blue/30 bg-white px-3 py-2 text-[13px] font-bold text-brand-blue hover:bg-brand-blue/5 disabled:opacity-60"
          >
            <LocateFixed className="h-4 w-4" />
            {busy === 'locating' ? 'Getting location…' : 'Use current location'}
          </button>
          <button
            type="button"
            onClick={locateTypedAddress}
            disabled={!!busy || saving}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            <MapPin className="h-4 w-4" />
            {busy === 'searching' ? 'Locating…' : 'Locate typed address'}
          </button>
        </div>

        <div className="mt-4">
          <HospitalMap
            hospital={{ latitude: addr.latitude, longitude: addr.longitude }}
            hospitalLabel={hospital.name || 'Hospital'}
            hospitalLogo={hospital.logo_url || null}
            height={220}
            className="overflow-hidden rounded-xl"
          />
          <div className={`mt-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-[13.5px] font-semibold ${
            pinned ? 'border-green-200 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-700'
          }`}>
            <Navigation className="h-4 w-4" />
            {pinned
              ? `Pin set · ${Number(addr.latitude).toFixed(5)}, ${Number(addr.longitude).toFixed(5)}`
              : 'No pin yet — search or use your current location.'}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TextInput label="City" value={addr.city} onChange={set('city')} />
          <TextInput label="State" value={addr.state} onChange={set('state')} />
          <TextInput label="Pincode" value={addr.pincode} onChange={set('pincode')} />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <ToolButton type="button" onClick={onClose}>Cancel</ToolButton>
          <ToolButton type="button" icon={Check} tone="primary" onClick={confirm} disabled={saving || !!busy}>
            {saving ? 'Saving…' : 'Save Address'}
          </ToolButton>
        </div>
      </div>
    </div>
  )
}
