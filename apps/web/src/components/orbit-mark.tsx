export function OrbitMark({ className = "size-10" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`relative shrink-0 ${className}`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        version="1.2"
        viewBox="0 0 836 879"
      >
        <defs>
          <linearGradient
            id="g1"
            x2="1"
            gradientTransform="rotate(45 63.519 339.152)scale(800.001 400)"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#5b6ef5"></stop>
            <stop offset="0.336" stopColor="#7c5cfc"></stop>
          </linearGradient>
        </defs>
        <path
          fill="#e5e2fc"
          fillRule="evenodd"
          opacity="0.75"
          d="M640.5 391C532.39 391 445 303.61 445 195.5S532.39 0 640.5 0 836 87.39 836 195.5 748.61 391 640.5 391"
        ></path>
        <path
          fill="none"
          stroke="#d2d8fa"
          strokeWidth="52"
          opacity="0.75"
          d="M400 853C193.18 853 26 685.82 26 479s167.18-374 374-374 374 167.18 374 374-167.18 374-374 374z"
        ></path>
        <path
          fill="url(#g1)"
          d="M117 195.84c156.21-156.21 409.48-156.21 565.68 0 156.22 156.21 156.22 409.48 0 565.69l-36.76-36.77c135.9-135.9 135.9-356.25 0-492.15-135.91-135.9-356.25-135.9-492.15 0z"
        ></path>
        <path
          fill="none"
          stroke="#000"
          d="M117 195.84c156.21-156.21 409.48-156.21 565.68 0 156.22 156.21 156.22 409.48 0 565.69l-36.76-36.77c135.9-135.9 135.9-356.25 0-492.15-135.91-135.9-356.25-135.9-492.15 0z"
        ></path>
        <path
          fill="#4657d9"
          fillRule="evenodd"
          d="M100.5 825C44.92 825 0 780.08 0 724.5S44.92 624 100.5 624 201 668.92 201 724.5 156.08 825 100.5 825"
        ></path>
        <path
          fill="#7c5cfc"
          fillRule="evenodd"
          d="M640.5 321C571.1 321 515 264.9 515 195.5S571.1 70 640.5 70 766 126.1 766 195.5 709.9 321 640.5 321"
        ></path>
      </svg>
    </div>
  );
}
