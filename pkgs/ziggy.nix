{
  lib,
  stdenv,
  fetchFromGitHub,
  zig,
}:

stdenv.mkDerivation (finalAttrs: {
  pname = "ziggy";
  version = "0.3.0";

  src = fetchFromGitHub {
    owner = "kristoff-it";
    repo = "ziggy";
    rev = "v${finalAttrs.version}";
    hash = "sha256-cRUb4kSZnvvj3N0VyGQr65H2DCllqnb/sSgwJkx1YIA=";
  };

  zigDeps = zig.fetchDeps {
    inherit (finalAttrs) src pname version;
    fetchAll = true;
    hash = "sha256-FnfCiRxizoU1T78DWlVSOcKHTw24IWL6WpLKCgtwkRY=";
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
    install -Dm755 zig-out/bin/ziggy -t "$out/bin"
    runHook postInstall
  '';

  meta = with lib; {
    description = "A data serialization language for expressing clear API messages, config files, etc";
    homepage = "https://github.com/kristoff-it/ziggy";
    license = licenses.mit;
    maintainers = with maintainers; [ jaudiger ];
  };
})
