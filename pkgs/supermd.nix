{
  lib,
  stdenv,
  fetchFromGitHub,
  zig,
}:

stdenv.mkDerivation (finalAttrs: {
  pname = "supermd";
  version = "d294f18f05b9f8ca908bbbe3778ae313ace629de";

  src = fetchFromGitHub {
    owner = "kristoff-it";
    repo = "supermd";
    rev = finalAttrs.version;
    hash = "sha256-MHZPkHgUNNpuAOpODlQCr3db52k+DM/A+p0r6wfKQPw=";
  };

  zigDeps = zig.fetchDeps {
    inherit (finalAttrs) src pname version;
    fetchAll = true;
    hash = "sha256-hFry86v8ftUJDQhP3D0wllGJkujD26BPVrUWI0NHNKE=";
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
    install -Dm755 zig-out/bin/docgen -t "$out/bin"
    runHook postInstall
  '';

  meta = with lib; {
    description = "SuperMD is an extension of Markdown used by https://zine-ssg.io";
    homepage = "https://github.com/kristoff-it/supermd";
    license = licenses.mit;
    maintainers = with maintainers; [ jaudiger ];
  };
})
