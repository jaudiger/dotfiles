{
  lib,
  stdenv,
  fetchFromGitHub,
  zig_master,
}:

stdenv.mkDerivation (finalAttrs: {
  pname = "ziggy";
  version = "0.2.0";

  src = fetchFromGitHub {
    owner = "kristoff-it";
    repo = "ziggy";
    rev = "v${finalAttrs.version}";
    hash = "sha256-luLYcGQ/2yi5SZbv1l7Be9LcizqiZdJY1i6TuxqFLdg=";
  };

  zigDeps = zig_master.fetchDeps {
    inherit (finalAttrs) src pname version;
    fetchAll = true;
    hash = "sha256-rndrm8eIMiUOyT8jkOqpS6rr7X7OWji1YBUPZUcwXY0=";
  };

  nativeBuildInputs = [ zig_master ];

  preConfigure = ''
    export ZIG_GLOBAL_CACHE_DIR="$TMPDIR/zig-global-cache"
    mkdir -p "$ZIG_GLOBAL_CACHE_DIR"
  '';

  postConfigure = ''
    ln -s ${finalAttrs.zigDeps} "$ZIG_GLOBAL_CACHE_DIR/p"
  '';

  buildPhase = ''
    runHook preBuild
    zig build "''${zigBuildFlags[@]}"
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
    homepage = "https://ziggy-lang.io";
    license = licenses.mit;
    maintainers = with maintainers; [ jaudiger ];
  };
})
