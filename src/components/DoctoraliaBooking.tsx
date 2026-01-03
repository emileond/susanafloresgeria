import { useEffect } from 'react';

const DoctoraliaBooking = () => {
  useEffect(() => {
    const id = 'zl-widget-s';
    if (!document.getElementById(id)) {
      const js = document.createElement('script');
      js.id = id;
      js.src = 'https://platform.docplanner.com/js/widget.js';
      const fjs = document.getElementsByTagName('script')[0];
      (fjs?.parentNode || document.head).insertBefore(js, fjs || null);
    }
  }, []);

  return (
    <a
      id="zl-url"
      className="zl-url"
      href="https://www.doctoralia.com.mx/susana-flores-alonso/geriatra/leon"
      rel="nofollow"
      data-zlw-doctor="susana-flores-alonso"
      data-zlw-type="big_with_calendar"
      data-zlw-opinion="false"
      data-zlw-hide-branding="true"
      data-zlw-saas-only="true"
      data-zlw-a11y-title="Widget de reserva de citas médicas"
    >
      Susana Flores Alonso - Doctoralia.com.mx
    </a>
  );
};

export default DoctoraliaBooking;