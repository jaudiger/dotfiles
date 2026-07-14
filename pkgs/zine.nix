{
  lib,
  stdenv,
  fetchFromGitHub,
  zig_master,
}:

stdenv.mkDerivation rec {
  pname = "zine";
  version = "0.12.0";

  src = fetchFromGitHub {
    owner = "kristoff-it";
    repo = "zine";
    rev = "v${version}";
    hash = "sha256-GcrheiUUhQkmUY9Uy6poIM7t1/5zsNH/wWHjrN8/FFo=";
  };

  nativeBuildInputs = [ zig_master ];

  postPatch = ''
    # Patch build.zig to return a valid version when git is not available
    substituteInPlace build.zig --replace 'return .unknown;' "return .{ .tag = \"${version}\" };"
  '';

  buildPhase = "zig build --global-cache-dir .zig-cache -Doptimize=ReleaseFast";
  installPhase = "install -Dm755 zig-out/bin/zine -t $out/bin";

  meta = with lib; {
    description = "Fast, Scalable, Flexible Static Site Generator (SSG)";
    homepage = "https://zine-ssg.io";
    license = licenses.mit;
    maintainers = with maintainers; [ jaudiger ];
  };
}
