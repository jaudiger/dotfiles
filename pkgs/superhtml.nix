{
  lib,
  stdenv,
  fetchFromGitHub,
  zig,
}:

stdenv.mkDerivation (finalAttrs: {
  pname = "superhtml";
  version = "0.7.1";

  src = fetchFromGitHub {
    owner = "kristoff-it";
    repo = "superhtml";
    rev = "v${finalAttrs.version}";
    hash = "sha256-m1a6lQ4UrXNHzAd8LTl9X53O1gEu4boYClrzCgmNV5w=";
  };

  zigDeps = zig.fetchDeps {
    inherit (finalAttrs) src pname version;
    fetchAll = true;
    hash = "sha256-Ah1D5FaloUvc3QUWjjRW+dhQA4uP1G2PR9u5qH1PTk4=";
  };

  nativeBuildInputs = [ zig ];

  preConfigure = ''
    export ZIG_GLOBAL_CACHE_DIR="$TMPDIR/zig-global-cache"
    mkdir -p "$ZIG_GLOBAL_CACHE_DIR"
  '';

  postConfigure = ''
    ln -s ${finalAttrs.zigDeps} "$ZIG_GLOBAL_CACHE_DIR/p"
  '';

  buildPhase = ''
    runHook preBuild
    zig build ${lib.escapeShellArgs finalAttrs.zigBuildFlags}
    runHook postBuild
  '';

  zigBuildFlags = [ "-Doptimize=ReleaseFast" ];

  installPhase = ''
    runHook preInstall
    install -Dm755 zig-out/bin/superhtml -t "$out/bin"
    runHook postInstall
  '';

  meta = with lib; {
    description = "HTML Language Server & Templating Language Library";
    homepage = "https://github.com/kristoff-it/superhtml";
    license = licenses.mit;
    maintainers = with maintainers; [ jaudiger ];
  };
})
