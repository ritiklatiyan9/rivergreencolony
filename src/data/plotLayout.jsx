// Exact public River Green layout, preserved from the official project component.
// Source: https://defencegarden.com/assets/RiverGreenMap-xvA5nAeC.js
// Original coordinate space: 1460 × 1370. Plot coordinates, dimensions, rows,
// road widths, boundary, roundabout, landscaping, and labels are unchanged.
// Payment / booking code is intentionally not included in this view.
export const MAP_WIDTH = 1460;
export const MAP_HEIGHT = 1370;
export default function PlotLayout({
  mapRef,
  onClick,
  onKeyDown,
  overlay
}) {
  return <div ref={mapRef} onClick={onClick} onKeyDown={onKeyDown} className="relative overflow-hidden font-sans official-map-layout" style={{
    width: "1460px",
    height: "1370px",
    backgroundColor: "#E8E4D9",
    margin: "0 auto"
  }}><div className="absolute inset-0" style={{
      top: "80px"
    }}><svg className="absolute inset-0 pointer-events-none z-50" width="1460" height="1255" style={{
        overflow: "visible"
      }}><path d="M 37.5 38 L 1393 -22 L 1118 1227.5 L 37.5 1227.5 Z" fill="none" stroke="#5A5A5A" strokeWidth="25" strokeLinejoin="round" /></svg><div className="absolute inset-0 z-[60] pointer-events-none">{Array.from({
          length: 23
        }).map((t, r) => <span aria-hidden="true" className="absolute select-none leading-none" style={{
          left: `${25 + r * 60}px`,
          top: `${2 - r * 2.6}px`,
          fontSize: "24px"
        }} key={`top-tree-${r}`}>{"🌳"}</span>)}{Array.from({
          length: 20
        }).map((t, r) => <span aria-hidden="true" className="absolute select-none leading-none z-50 inline-block" style={{
          left: "-5px",
          top: `${60 + r * 58}px`,
          fontSize: "24px"
        }} key={`left-tree-${r}`}>{"🌲"}</span>)}{Array.from({
          length: 21
        }).map((t, r) => {
          const a = 60 + r * 58,
            o = 1393 - a * .22;
          return <span aria-hidden="true" className="absolute select-none leading-none" style={{
            left: `${o + 22}px`,
            top: `${a - 10}px`,
            fontSize: "24px"
          }} key={`right-tree-${r}`}>{"🌳"}</span>;
        })}{Array.from({
          length: 18
        }).map((t, r) => <span aria-hidden="true" className="absolute select-none leading-none" style={{
          left: `${40 + r * 60}px`,
          top: "1242px",
          fontSize: "24px"
        }} key={`bottom-tree-${r}`}>{"🌲"}</span>)}</div><div className="absolute bg-[#4A4A4A] center-road-mask flex flex-col items-center z-30 border-x border-[#333]" style={{
        left: "650px",
        top: "15px",
        width: "40px",
        height: "1215px"
      }}><div className="absolute inset-0 flex flex-col items-center justify-start overflow-hidden pt-8 pb-4" style={{
          gap: "22px"
        }}>{Array.from({
            length: 45
          }).map((t, r) => <div className="w-4 h-4 flex items-center justify-center" aria-hidden="true" key={`tree-${r}`}><span className="text-[13px] leading-none">{r % 2 === 0 ? "🌳" : "🌲"}</span></div>)}</div><div className="absolute" style={{
          top: "135px",
          backgroundColor: "#4A4A4A",
          padding: "10px 0"
        }}><span className="text-white/90 text-[11px] font-bold z-10 py-1 uppercase block" style={{
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            letterSpacing: "4px"
          }}>{`ROAD 40'-0" WD`}</span></div><div className="absolute" style={{
          top: "650px",
          backgroundColor: "#4A4A4A",
          padding: "10px 0"
        }}><span className="text-white/90 text-[11px] font-bold z-10 py-1 uppercase block" style={{
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            letterSpacing: "4px"
          }}>{`ROAD 40'-0" WD`}</span></div><div className="absolute" style={{
          top: "950px",
          backgroundColor: "#4A4A4A",
          padding: "10px 0"
        }}><span className="text-white/90 text-[11px] font-bold z-10 py-1 uppercase block" style={{
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            letterSpacing: "4px"
          }}>{`ROAD 40'-0" WD`}</span></div></div><div className="absolute z-40 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none" style={{
        left: "670px",
        top: "532.5px",
        width: "180px",
        height: "160px"
      }}><div className="absolute inset-0 rounded-full bg-[#4A4A4A] flex items-center justify-center overflow-hidden">{"              "}</div><div className="rounded-full bg-[#4CA049] flex items-center justify-center relative border-[3px] border-white shadow-xl z-30 overflow-hidden" style={{
          width: "85px",
          height: "85px"
        }}><div className="absolute inset-0 opacity-30" style={{
            backgroundImage: "radial-gradient(#1A3B08 1.5px, transparent 1.5px)",
            backgroundSize: "8px 8px"
          }} /><div className="absolute inset-0 flex items-center justify-center">{Array.from({
              length: 12
            }).map((t, r) => <div className="absolute w-[18px] h-[18px] border-[4px] border-[#2c8f30] rounded-full opacity-90" style={{
              transform: `rotate(${r * 30}deg) translateY(-22px)`
            }} key={`ring-${r}`} />)}</div><div className="w-[14px] h-[14px] bg-[#111] rounded-full shadow-lg relative flex items-center justify-center overflow-hidden border border-[#000]"><div className="absolute bg-[#555] w-[5px] h-[6px] rounded-full top-1 left-1" /></div></div></div><div className="absolute flex flex-col z-20" style={{
        left: "50px",
        top: "50px",
        width: "600px"
      }}><div className="grid w-full bg-green-800 border-b-2 border-[#222]" style={{
          height: "107px",
          marginTop: "-27px",
          clipPath: "polygon(0 27px, 100% 0, 100% 100%, 0 100%)",
          gridTemplateColumns: "repeat(8, 1fr) 84px"
        }}>{["10", "11", "12", "13", "14", "15", "16", "17"].map((t, r) => <div className="border-r border-[#222] relative flex items-center justify-center box-border" key={`l1-${r}`}><span className="text-[12px] font-bold text-[#A32A2A]">{"C-"}{t}</span><span className="absolute bottom-[2px] right-[2px] text-[6px] text-gray-500 font-bold">{t === "10" ? "21'" : "22'"}</span></div>)}<div className="relative flex flex-col items-center justify-center bg-green-800 border-r border-[#222] box-border"><span className="text-[14px] font-bold text-[#A32A2A]">{"C-18"}</span><span className="absolute bottom-[2px] right-[2px] text-[6px] text-gray-500 font-bold">{"45'"}</span></div></div><div className="w-full bg-[#4A4A4A] flex items-center justify-center border-y border-[#333] z-20 relative" style={{
          height: "25px"
        }}><div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t border-dashed border-[#FFF] opacity-30" /><span className="relative z-10 text-white/90 text-[9px] font-bold tracking-[6px] px-2 bg-[#4A4A4A] rounded">{`ROAD 25'-0" WD.`}</span></div><div className="grid w-full bg-green-800 border-y-2 border-[#222]" style={{
          height: "80px",
          gridTemplateColumns: "repeat(8, 1fr) 84px"
        }}>{["9", "8", "7", "6", "5", "4", "3", "2"].map((t, r) => <div className="border-r border-[#222] relative flex items-center justify-center box-border" key={`l2-${r}`}><span className="text-[12px] font-bold text-[#A32A2A]">{"C-"}{t}</span><span className="absolute top-[2px] right-[2px] text-[6px] text-gray-500 font-bold">{t === "9" ? "21'" : "22'"}</span></div>)}<div className="relative flex flex-col items-center justify-center bg-green-800 border-r border-[#222] box-border"><span className="text-[14px] font-bold text-[#A32A2A]">{"C-1"}</span><span className="absolute top-[2px] right-[2px] text-[6px] text-gray-500 font-bold">{"45'"}</span></div></div><div className="grid w-full bg-green-800 border-b-2 border-[#222]" style={{
          height: "85px",
          gridTemplateColumns: "repeat(7, 1fr) 110px"
        }}>{["B-55", "B-56", "B-57", "B-58", "B-59", "B-60", "B-61"].map((t, r) => <div className="border-r border-[#222] relative flex items-center justify-center box-border" key={`l3-${r}`}><span className="text-[11px] font-bold text-[#111]">{t}</span><span className="absolute bottom-[2px] right-[2px] text-[6px] text-[#222] font-bold">{"25'"}</span></div>)}<div className="relative flex items-center justify-center bg-green-800 border-r border-[#222] box-border"><span className="text-[14px] font-bold text-[#111]">{"B-62"}</span><span className="absolute bottom-[2px] right-[2px] text-[6px] text-[#222] font-bold">{"45'"}</span></div></div><div className="w-full bg-[#4A4A4A] flex items-center justify-center border-y border-[#333] z-20 relative" style={{
          height: "25px"
        }}><div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t border-dashed border-[#FFF] opacity-30" /><span className="relative z-10 text-white/90 text-[9px] font-bold tracking-[6px] px-2 bg-[#4A4A4A] rounded">{`ROAD 30'-0" WD.`}</span></div><div className="grid w-full bg-green-800 border-y-2 border-[#222]" style={{
          height: "85px",
          gridTemplateColumns: "repeat(7, 1fr) 1.8fr"
        }}>{["B-54", "B-53", "B-52", "B-51", "B-50", "B-49", "B-48"].map((t, r) => <div className="border-r border-[#222] relative flex items-center justify-center box-border" key={`l4-${r}`}><span className="text-[12px] font-bold text-[#111]">{t}</span><span className="absolute top-[2px] right-[2px] text-[6px] text-[#222] font-bold">{"25'"}</span></div>)}<div className="relative flex items-center justify-center bg-green-800 border-r border-[#222] box-border"><span className="text-[14px] font-bold text-[#111]">{"B-47"}</span><span className="absolute top-[2px] right-[2px] text-[6px] text-[#222] font-bold">{"45'"}</span></div></div><div className="grid w-full bg-green-800 border-b-2 border-[#222]" style={{
          height: "85px",
          gridTemplateColumns: "repeat(7, 1fr) 140px"
        }}>{["B-40", "B-41", "B-42", "B-43", "B-44", "B-45", "B-46"].map((t, r) => <div className="border-r border-[#222] relative flex items-center justify-center box-border" key={`l5-${r}`}><span className="text-[12px] font-bold text-[#111]">{t}</span><span className="absolute bottom-[2px] right-[2px] text-[6px] text-[#222] font-bold">{"25'"}</span></div>)}<div className="bg-[#7BBA49] border-t border-l border-[#38641C] relative overflow-hidden flex items-center justify-center shadow-inner box-border" style={{
            borderBottomRightRadius: "90px"
          }}><div className="absolute inset-0 opacity-20" style={{
              backgroundImage: "radial-gradient(#1A3B08 1.5px, transparent 1.5px)",
              backgroundSize: "10px 10px"
            }} /><span className="text-[#38641C] font-bold tracking-widest relative z-10 text-[14px]" /></div></div><div className="w-full bg-[#4A4A4A] flex items-center justify-center border-y border-[#333] z-20 relative" style={{
          height: "35px"
        }}><div className="absolute left-0 right-[80px] top-1/2 -translate-y-1/2 border-t-2 border-dashed border-[#FFF] opacity-40" /><span className="relative z-10 text-white/90 text-[10px] font-bold tracking-[8px] bg-[#4A4A4A] px-4 rounded">{`ROAD 35'-0" WD.`}</span></div><div className="grid w-full bg-green-800 border-y-2 border-[#222]" style={{
          height: "85px",
          gridTemplateColumns: "repeat(6, 1fr) 1.8fr 140px"
        }}>{["B-39", "B-38", "B-37", "B-36", "B-35", "B-34"].map((t, r) => <div className="border-r border-[#222] relative flex items-center justify-center box-border" key={`l6-${r}`}><span className="text-[12px] font-bold text-[#111]">{t}</span><span className="absolute top-[2px] right-[2px] text-[6px] text-[#222] font-bold">{"25'"}</span></div>)}<div className="relative flex items-center justify-center bg-green-800 border-r border-[#222] box-border"><span className="text-[14px] font-bold text-[#111]">{"B-33"}</span><span className="absolute top-[2px] right-[2px] text-[6px] text-[#222] font-bold">{"45'"}</span></div><div className="bg-[#7BBA49] border-b border-l border-[#38641C] relative overflow-hidden flex items-center justify-center shadow-inner box-border" style={{
            borderTopRightRadius: "90px"
          }}><div className="absolute inset-0 opacity-20" style={{
              backgroundImage: "radial-gradient(#1A3B08 1.5px, transparent 1.5px)",
              backgroundSize: "10px 10px"
            }} /></div></div><div className="grid w-full bg-green-800 border-b-2 border-[#222]" style={{
          height: "85px",
          gridTemplateColumns: "repeat(7, 1fr) 1.8fr"
        }}>{["B-25", "B-26", "B-27", "B-28", "B-29", "B-30", "B-31"].map((t, r) => <div className="border-r border-[#222] relative flex items-center justify-center box-border" key={`l8-${r}`}><span className="text-[12px] font-bold text-[#111]">{t}</span><span className="absolute bottom-[2px] right-[2px] text-[6px] text-[#222] font-bold">{"25'"}</span></div>)}<div className="relative flex items-center justify-center bg-green-800 border-r border-[#222] box-border"><span className="text-[14px] font-bold text-[#111]">{"B-32"}</span><span className="absolute bottom-[2px] right-[2px] text-[6px] text-[#222] font-bold">{"45'"}</span></div></div><div className="w-full bg-[#4A4A4A] flex items-center justify-center border-y border-[#333] z-20 relative" style={{
          height: "35px"
        }}><div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-[#FFF] opacity-40" /><span className="relative z-10 text-white/90 text-[10px] font-bold tracking-[8px] bg-[#4A4A4A] px-4 rounded">{`ROAD 30'-0" WD.`}</span></div><div className="grid w-full bg-green-800 border-t-2 border-b border-[#222]" style={{
          height: "85px",
          gridTemplateColumns: "repeat(7, 1fr) 1.8fr"
        }}>{["B-24", "B-23", "B-22", "B-21", "B-20", "B-19", "B-18"].map((t, r) => <div className="border-r border-[#222] relative flex items-center justify-center box-border" key={`l9-${r}`}><span className="text-[12px] font-bold text-[#111]">{t}</span><span className="absolute top-[2px] right-[2px] text-[6px] text-[#222] font-bold">{"25'"}</span></div>)}<div className="relative flex items-center justify-center bg-green-800 border-r border-[#222] box-border"><span className="text-[13px] font-bold text-[#111]">{"B-17"}</span><span className="absolute top-[2px] right-[2px] text-[6px] text-[#222] font-bold">{"45'"}</span></div></div><div className="grid w-full bg-green-800 border-b-2 border-[#222]" style={{
          height: "85px",
          gridTemplateColumns: "repeat(7, 1fr) 1.8fr"
        }}>{["B-9", "B-10", "B-11", "B-12", "B-13", "B-14", "B-15"].map((t, r) => <div className="border-r border-[#222] relative flex items-center justify-center box-border" key={`l10-${r}`}><span className="text-[12px] font-bold text-[#111]">{t}</span><span className="absolute bottom-[2px] right-[2px] text-[6px] text-[#222] font-bold">{"25'"}</span></div>)}<div className="relative flex items-center justify-center bg-green-800 border-r border-[#222] box-border"><span className="text-[13px] font-bold text-[#111]">{"B-16"}</span><span className="absolute bottom-[2px] right-[2px] text-[6px] text-[#222] font-bold">{"45'"}</span></div></div><div className="w-full bg-[#4A4A4A] flex items-center justify-center border-y border-[#333] z-20 relative" style={{
          height: "30px"
        }}><div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-[#FFF] opacity-40" /><span className="relative z-10 text-white/90 text-[10px] font-bold tracking-[8px] bg-[#4A4A4A] px-4 rounded">{`ROAD 30'-0" WD.`}</span></div><div className="grid w-full bg-green-800 border-b-2 border-[#222]" style={{
          height: "85px",
          gridTemplateColumns: "repeat(7, 1fr) 1.8fr"
        }}>{["B-8", "B-7", "B-6", "B-5", "B-4", "B-3", "B-2"].map((t, r) => <div className="border-r border-[#222] relative flex items-center justify-center box-border" key={`l11-${r}`}><span className="text-[12px] font-bold text-[#111]">{t}</span><span className="absolute bottom-[2px] right-[2px] text-[6px] text-[#222] font-bold">{"25'"}</span></div>)}<div className="relative flex items-center justify-center bg-green-800 border-r border-[#222] box-border"><span className="text-[13px] font-bold text-[#111]">{"B-1"}</span><span className="absolute bottom-[2px] right-[2px] text-[6px] text-[#222] font-bold">{"45'"}</span></div></div><div className="flex w-full bg-[#E090B8] border-b-2 border-[#222]" style={{
          height: "85px"
        }}><div className="bg-[#7BBA49] border-r-2 border-[#38641C] relative flex items-center justify-center box-border w-[130px] shrink-0"><div className="absolute inset-0 opacity-20" style={{
              backgroundImage: "radial-gradient(#1A3B08 1.5px, transparent 1.5px)",
              backgroundSize: "10px 10px"
            }} /><span className="text-[#38641C] font-bold tracking-wider relative z-10 text-[10px]">{"PARK"}</span></div><div className="flex-1 grid" style={{
            gridTemplateColumns: "repeat(17, 1fr)"
          }}>{["S34", "S33", "S32", "S31", "S30", "S29", "S28", "S27", "S26", "S25", "S24", "S23", "S22", "S21", "S20", "S19", "S18"].map((t, r) => <div className="border-r border-[#222] relative flex items-center justify-center box-border" key={`l12-${r}`}><span className="text-[9px] font-bold text-[#7a2650]">{"("}{t}{")"}</span></div>)}</div></div><div className="w-full bg-[#4A4A4A] flex items-center justify-center border-y border-[#333] z-20 relative" style={{
          height: "25px"
        }}><div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t border-dashed border-[#FFF] opacity-30" /><span className="relative z-10 text-white/90 text-[10px] font-bold tracking-[8px] bg-[#4A4A4A] px-4 rounded">{`ROAD 25'-0" WD.`}</span></div></div><div className="absolute z-[15]" style={{
        left: "37px",
        top: "1145px",
        width: "1090px",
        height: "83px",
        backgroundColor: "#5A5A5A"
      }} /><div className="absolute z-20" style={{
        left: "690px",
        top: "50px",
        width: "730px",
        height: "1165px",
        clipPath: "polygon(0px -100px, 709px -100px, 431px 1165px, 0px 1165px)",
        WebkitClipPath: "polygon(0px -100px, 709px -100px, 431px 1165px, 0px 1165px)"
      }}><div className="flex flex-col w-full absolute top-0 left-0"><div className="grid w-full bg-green-800 border-b-2 border-[#222]" style={{
            height: "140px",
            marginTop: "-60px",
            clipPath: "polygon(0 31px, 100% 0, 100% 100%, 0 100%)",
            gridTemplateColumns: "70px repeat(9, 1fr) minmax(40px, 200px)"
          }}><div className="border-l border-r border-[#222] relative flex items-center justify-center bg-green-800 box-border"><span className="text-[13px] font-bold text-[#A32A2A]">{"C-19"}</span><span className="absolute bottom-[2px] right-[2px] text-[6px] text-gray-500 font-bold">{"45'"}</span></div>{["C-20", "C-21", "C-22", "C-23", "C-24", "C-25", "C-26", "C-27", "C-28"].map((t, r) => <div className="border-r border-[#222] relative flex items-center justify-center box-border" key={`r1-${r}`}><span className="text-[12px] font-bold text-[#A32A2A]">{t}</span><span className="absolute bottom-[2px] right-[2px] text-[6px] text-gray-500 font-bold">{"25'"}</span></div>)}<div className="relative flex items-center justify-start pl-2 overflow-hidden box-border border-r border-[#222]"><span className="text-[13px] font-bold text-[#A32A2A]">{"C-29"}</span><span className="absolute bottom-[2px] left-[5px] text-[6px] text-gray-500 font-bold">{"55'"}</span></div></div><div className="w-full bg-[#4A4A4A] border-y border-[#333] z-20" style={{
            height: "25px",
            display: "flex",
            alignItems: "center",
            paddingLeft: "200px"
          }}><span className="text-white/90 text-[9px] font-bold tracking-[6px]">{`ROAD 25'-0" WD.`}</span></div><div className="grid w-full bg-green-800 border-y-2 border-[#222]" style={{
            height: "80px",
            gridTemplateColumns: "70px repeat(11, 1fr) minmax(60px, 200px)"
          }}><div className="border-l border-r border-[#222] relative flex items-center justify-center bg-green-800 box-border"><span className="text-[13px] font-bold text-[#A32A2A]">{"C-42"}</span><span className="absolute top-[2px] right-[2px] text-[6px] text-gray-500 font-bold">{"45'"}</span></div>{["C-41", "C-40", "C-39", "C-38", "C-37", "C-36", "C-35", "C-34", "C-33", "C-32", "C-31"].map((t, r) => <div className="border-r border-[#222] relative flex items-center justify-center box-border" key={`r2-${r}`}><span className="text-[11px] font-bold text-[#A32A2A]">{t}</span><span className="absolute top-[2px] right-[2px] text-[6px] text-gray-500 font-bold">{"20'"}</span></div>)}<div className="relative flex items-center justify-start pl-2 overflow-hidden box-border border-r border-[#222]"><span className="text-[13px] font-bold text-[#A32A2A]">{"C-30"}</span><span className="absolute bottom-[2px] left-[5px] text-[6px] text-gray-500 font-bold">{`34'-6"`}</span></div></div><div className="grid w-full bg-green-800 border-b-2 border-[#222]" style={{
            height: "80px",
            gridTemplateColumns: "70px repeat(8, 1fr) minmax(80px, 200px)"
          }}><div className="border-l border-r border-[#222] relative flex items-center justify-center bg-green-800 box-border"><span className="text-[13px] font-bold text-[#111]">{"A-54"}</span><span className="absolute bottom-[2px] right-[2px] text-[6px] text-[#444] font-bold">{"45'"}</span></div>{["A-55", "A-56", "A-57", "A-58", "A-59", "A-60", "A-61", "A-62"].map((t, r) => <div className="border-r border-[#222] relative flex items-center justify-center box-border" key={`r3-${r}`}><span className="text-[11px] font-bold text-[#111]">{t}</span><span className="absolute bottom-[2px] right-[2px] text-[6px] text-[#444] font-bold">{"25'"}</span></div>)}<div className="relative border-r border-[#222] box-border flex items-center justify-start pl-2"><span className="text-[12px] font-bold text-[#111]">{"A-63"}</span><span className="absolute bottom-[2px] left-[5px] text-[6px] text-[#444] font-bold">{`29'-2"`}</span><span className="absolute top-[2px] left-[5px] text-[6px] text-[#444] font-bold">{`45'-6"`}</span></div></div><div className="w-full bg-[#4A4A4A] flex items-center justify-center border-y border-[#333] z-20 relative" style={{
            height: "35px"
          }}><div className="absolute left-[80px] right-0 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-[#FFF] opacity-40" /><span className="relative z-10 text-white/90 text-[10px] font-bold tracking-[8px] bg-[#4A4A4A] px-4 rounded">{`ROAD 30'-0" WD.`}</span></div><div className="grid w-full bg-green-800 border-y-2 border-[#222]" style={{
            height: "85px",
            gridTemplateColumns: "1.8fr repeat(7, 1fr) 200px"
          }}><div className="border-l border-r border-[#222] relative flex items-center justify-center bg-green-800 box-border"><span className="text-[13px] font-bold text-[#111]">{"A-53"}</span><span className="absolute top-[2px] right-[2px] text-[6px] text-[#444] font-bold">{"45'"}</span></div>{["A-52", "A-51", "A-50", "A-49", "A-48", "A-47", "A-46"].map((t, r) => <div className="border-r border-[#222] relative flex items-center justify-center box-border" key={`r4-${r}`}><span className="text-[12px] font-bold text-[#111]">{t}</span><span className="absolute top-[2px] right-[2px] text-[6px] text-[#444] font-bold">{"25'"}</span></div>)}<div className="border-r border-[#222] relative box-border pl-2 flex items-center justify-start"><span className="text-[12px] font-bold text-[#111]">{"A-45"}</span><span className="absolute top-[2px] left-[5px] text-[6px] text-[#444] font-bold">{`48'-4"`}</span><span className="absolute bottom-[2px] left-[5px] text-[6px] text-[#444] font-bold">{`34'-2"`}</span></div></div><div className="grid w-full bg-green-800 border-b-2 border-[#222]" style={{
            height: "85px",
            gridTemplateColumns: "140px repeat(7, 1fr) 205px"
          }}><div className="border-l bg-[#7BBA49] border-t border-r border-[#38641C] relative overflow-hidden flex items-center justify-center shadow-inner box-border" style={{
              borderBottomLeftRadius: "90px"
            }}><div className="absolute inset-0 opacity-20" style={{
                backgroundImage: "radial-gradient(#1A3B08 1.5px, transparent 1.5px)",
                backgroundSize: "10px 10px"
              }} /><span className="text-[#38641C] font-bold tracking-widest relative z-10 text-[14px]" /></div>{["A-36", "A-37", "A-38", "A-39", "A-40", "A-41", "A-42"].map((t, r) => <div className="border-r border-[#222] relative flex items-center justify-center box-border" key={`r5-${r}`}><span className="text-[12px] font-bold text-[#111]">{t}</span><span className="absolute bottom-[2px] right-[2px] text-[6px] text-[#444] font-bold">{"25'"}</span></div>)}<div className="border-r border-[#222] relative box-border pl-2 flex items-center justify-start"><span className="text-[12px] font-bold text-[#111]">{"A-43"}</span><span className="absolute bottom-[2px] left-[5px] text-[6px] text-[#444] font-bold">{`33'-8"`}</span></div></div><div className="w-full bg-[#4A4A4A] flex items-center justify-center border-y border-[#333] z-20 relative" style={{
            height: "30px"
          }}><div className="absolute left-[50px] right-0 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-[#FFF] opacity-40" /><span className="relative z-10 text-white/90 text-[10px] font-bold tracking-[8px] bg-[#4A4A4A] px-4 rounded">{`ROAD 30'-0" WD.`}</span></div><div className="grid w-full bg-green-800 border-b-2 border-[#222]" style={{
            height: "85px",
            gridTemplateColumns: "140px repeat(6, 1fr) 240px"
          }}><div className="border-l bg-[#7BBA49] border-b border-r border-[#38641C] relative overflow-hidden flex items-center justify-center shadow-inner box-border" style={{
              borderTopLeftRadius: "90px"
            }}><div className="absolute inset-0 opacity-20" style={{
                backgroundImage: "radial-gradient(#1A3B08 1.5px, transparent 1.5px)",
                backgroundSize: "10px 10px"
              }} /></div>{["A-35", "A-34", "A-33", "A-32", "A-31", "A-30"].map((t, r) => <div className="border-r border-[#222] relative flex items-center justify-center box-border" key={`r6-${r}`}><span className="text-[12px] font-bold text-[#111]">{t}</span><span className="absolute top-[2px] right-[2px] text-[6px] text-[#444] font-bold">{"25'"}</span></div>)}<div className="border-r border-[#222] relative box-border"><span className="absolute top-1/2 -translate-y-1/2 left-[8px] text-[12px] font-bold text-[#111]">{"A-29"}</span><span className="absolute top-[2px] left-[5px] text-[6px] text-[#444] font-bold">{"40'"}</span><span className="absolute bottom-[2px] left-[5px] text-[6px] text-[#444] font-bold">{`29'-1"`}</span></div></div><div className="grid w-full bg-green-800 border-b-2 border-[#222]" style={{
            height: "85px",
            gridTemplateColumns: "1.8fr repeat(6, 1fr) 240px"
          }}><div className="border-l border-r border-[#222] relative flex items-center justify-center bg-green-800 box-border"><span className="text-[13px] font-bold text-[#111]">{"A-21"}</span><span className="absolute bottom-[2px] right-[2px] text-[6px] text-[#444] font-bold">{"45'"}</span></div>{["A-22", "A-23", "A-24", "A-25", "A-26", "A-27"].map((t, r) => <div className="border-r border-[#222] relative flex items-center justify-center box-border" key={`r8-${r}`}><span className="text-[12px] font-bold text-[#111]">{t}</span><span className="absolute bottom-[2px] right-[2px] text-[6px] text-[#444] font-bold">{"25'"}</span></div>)}<div className="border-r border-[#222] relative box-border pl-2 flex items-center justify-start"><span className="text-[12px] font-bold text-[#111]">{"A-28"}</span><span className="absolute bottom-[2px] left-[5px] text-[6px] text-[#444] font-bold">{`20'-8"`}</span></div></div><div className="w-full bg-[#4A4A4A] flex items-center justify-center border-y border-[#333] z-20 relative" style={{
            height: "30px"
          }}><div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-[#FFF] opacity-40" /><span className="relative z-10 text-white/90 text-[10px] font-bold tracking-[8px] bg-[#4A4A4A] px-4 rounded">{`ROAD 30'-0" WD.`}</span></div><div className="grid w-full bg-green-800 border-t-2 border-b border-[#222]" style={{
            height: "85px",
            gridTemplateColumns: "1.8fr repeat(5, 1fr) 280px"
          }}><div className="border-l border-r border-[#222] relative flex items-center justify-center bg-green-800 box-border"><span className="text-[13px] font-bold text-[#111]">{"A-20"}</span><span className="absolute top-[2px] right-[2px] text-[6px] text-[#444] font-bold">{"45'"}</span></div>{["A-19", "A-18", "A-17", "A-16", "A-15"].map((t, r) => <div className="border-r border-[#222] relative flex items-center justify-center box-border" key={`r9-${r}`}><span className="text-[12px] font-bold text-[#111]">{t}</span><span className="absolute top-[2px] right-[2px] text-[6px] text-[#444] font-bold">{"25'"}</span></div>)}<div className="border-r border-[#222] relative box-border"><span className="absolute top-1/2 -translate-y-1/2 left-[8px] text-[12px] font-bold text-[#111]">{"A-14"}</span><span className="absolute top-[2px] left-[5px] text-[6px] text-[#444] font-bold">{`40'-6½"`}</span><span className="absolute bottom-[2px] left-[5px] text-[6px] text-[#444] font-bold">{`32'-0½"`}</span></div></div><div className="grid w-full bg-green-800 border-b-2 border-[#222]" style={{
            height: "85px",
            gridTemplateColumns: "1.8fr repeat(5, 1fr) 280px"
          }}><div className="border-l border-r border-[#222] relative flex items-center justify-center bg-green-800 box-border"><span className="text-[13px] font-bold text-[#111]">{"A-7"}</span><span className="absolute bottom-[2px] right-[2px] text-[6px] text-[#444] font-bold">{"45'"}</span></div>{["A-8", "A-9", "A-10", "A-11", "A-12"].map((t, r) => <div className="border-r border-[#222] relative flex items-center justify-center box-border" key={`r10-${r}`}><span className="text-[12px] font-bold text-[#111]">{t}</span><span className="absolute bottom-[2px] right-[2px] text-[6px] text-[#444] font-bold">{"25'"}</span></div>)}<div className="border-r border-[#222] box-border relative"><span className="absolute top-1/2 -translate-y-1/2 left-[8px] text-[12px] font-bold text-[#111]">{"A-13"}</span><span className="absolute top-[2px] left-[5px] text-[6px] text-[#444] font-bold">{`32'-0½"`}</span><span className="absolute bottom-[2px] left-[5px] text-[6px] text-[#444] font-bold">{`23'-8½"`}</span></div></div><div className="w-full bg-[#4A4A4A] flex items-center justify-center border-y border-[#333] z-20 relative" style={{
            height: "30px"
          }}><div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-[#FFF] opacity-40" /><span className="relative z-10 text-white/90 text-[10px] font-bold tracking-[8px] bg-[#4A4A4A] px-4 rounded">{`ROAD 30'-0" WD.`}</span></div><div className="grid w-full bg-green-800 border-b-2 border-[#222]" style={{
            height: "85px",
            gridTemplateColumns: "1.8fr repeat(4, 1fr) 330px"
          }}><div className="border-l border-r border-[#222] relative flex items-center justify-center bg-green-800 box-border"><span className="text-[13px] font-bold text-[#111]">{"A-6"}</span><span className="absolute bottom-[2px] right-[2px] text-[6px] text-[#444] font-bold">{"45'"}</span></div>{["A-5", "A-4", "A-3", "A-2"].map((t, r) => <div className="border-r border-[#222] relative flex items-center justify-center box-border" key={`r11-${r}`}><span className="text-[12px] font-bold text-[#111]">{t}</span><span className="absolute bottom-[2px] right-[2px] text-[6px] text-[#444] font-bold">{"25'"}</span></div>)}<div className="border-r border-[#222] box-border relative"><span className="absolute top-1/2 -translate-y-1/2 left-[8px] text-[12px] font-bold text-[#111]">{"A-1"}</span><span className="absolute top-[2px] left-[5px] text-[6px] text-[#444] font-bold">{"43'"}</span><span className="absolute bottom-[2px] left-[5px] text-[6px] text-[#444] font-bold">{`35'-3"`}</span></div></div><div className="flex bg-[#E090B8] border-b-2 border-[#222]" style={{
            height: "85px",
            width: "455px"
          }}><div className="flex-1 grid" style={{
              gridTemplateColumns: "repeat(17, 1fr)"
            }}>{["S17", "S16", "S15", "S14", "S13", "S12", "S11", "S10", "S9", "S8", "S7", "S6", "S5", "S4", "S3", "S2", "S1"].map((t, r) => <div className="border-r border-[#222] relative flex items-center justify-center box-border bg-[#E090B8]" key={`r12-${r}`}><span className="text-[9px] font-bold text-[#7a2650]">{"("}{t}{")"}</span></div>)}</div></div><div className="bg-[#4A4A4A] flex items-center justify-center border-y border-[#333] z-20 relative" style={{
            height: "25px",
            width: "445px"
          }}><div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t border-dashed border-[#FFF] opacity-30" /><span className="relative z-10 text-white/90 text-[9px] font-bold tracking-[6px] bg-[#4A4A4A] px-2 rounded">{`ROAD 25'-0" WD.`}</span></div><div style={{
            height: "25px",
            width: "435px",
            backgroundColor: "#5A5A5A"
          }} /></div></div>{overlay}</div></div>;
}
