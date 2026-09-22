/* eslint-disable @fnando/consistent-import/consistent-import */
// Export all logo token image assets from this file for easy importing
import blockaidLogo from "./blockaid-logo.svg";
import stellarLogo from "./stellar-logo.png";
import usdcLogo from "./usdc-logo.png";
import varialLogo2d from "./varial-logo-2d.png";
import walletConnectLogo from "./walletconnect-logo.png";

// The colored Varial mark is not here: it is an svg tinted with the primary
// color, so it is imported as a component the way blockaid-logo.svg is, rather
// than as an <Image> source alongside these.
export const logos = {
  stellar: stellarLogo,
  varial2d: varialLogo2d,
  blockaid: blockaidLogo,
  walletConnect: walletConnectLogo,
  usdc: usdcLogo,
};
