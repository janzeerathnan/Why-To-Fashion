tailwind.config = {
  theme: {
    extend: {
      colors: {
        wtf: {
          black:  '#ffffff',   // Light theme background
          dark:   '#f9fafb',   // Light theme secondary background
          card:   '#ffffff',   // Cards background
          border: '#e5e7eb',   // Borders
          green:  '#14532d',   // Darker green for text/accents contrast
          lime:   '#4d7c0f',   // Darker lime
          gold:   '#b45309',   // Darker gold/amber
          cream:  '#111827',   // Primary text color (dark)
          muted:  '#4b5563',   // Muted text color
        }
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'sans-serif'],
        heading: ['"Barlow Condensed"', 'sans-serif'],
        body:    ['"Barlow"', 'sans-serif'],
      }
    }
  }
}
