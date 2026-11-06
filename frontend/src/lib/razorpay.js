/** Load Razorpay Checkout once and open it; resolves with the payment result,
 *  or null if the user closed it. */
function loadCheckout() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true)
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })
}

export async function openCheckout(options) {
  if (!(await loadCheckout())) throw new Error('Could not load the payment window. Check your internet and try again.')
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      ...options,
      theme: { color: '#0d9488' },
      handler: (res) => resolve(res),
      modal: { ondismiss: () => resolve(null) },
    })
    rzp.on('payment.failed', (res) => reject(new Error(res?.error?.description || 'Payment failed')))
    rzp.open()
  })
}
