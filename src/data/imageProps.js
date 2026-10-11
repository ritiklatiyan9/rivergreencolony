import assets from './imageAssets.json';

// Sizes describe the image surface, including extra width needed by cover crops.
// Width descriptors let the browser choose a file for the viewport and pixel ratio.
export function imageProps(src, sizes = '100vw') {
  const asset = assets[src];
  return {
    src,
    decoding: 'async',
    ...(asset && {
      width: asset.width,
      height: asset.height,
      srcSet: asset.sources.map(({ src: url, width }) => `${url} ${width}w`).join(', '),
      sizes,
    }),
  };
}
