package main

/* scrypt (RFC 7914), the same function and parameters Node's
   crypto.scryptSync used (N=16384, r=8, p=1), so passwords set with the
   earlier version keep working. */

import (
	"crypto/pbkdf2"
	"crypto/sha256"
	"encoding/binary"
	"math/bits"
)

func salsaXOR(tmp *[16]uint32, in, out []uint32) {
	var x [16]uint32
	for i := range x {
		tmp[i] ^= in[i]
		x[i] = tmp[i]
	}
	rot := bits.RotateLeft32
	for i := 0; i < 8; i += 2 {
		x[4] ^= rot(x[0]+x[12], 7)
		x[8] ^= rot(x[4]+x[0], 9)
		x[12] ^= rot(x[8]+x[4], 13)
		x[0] ^= rot(x[12]+x[8], 18)
		x[9] ^= rot(x[5]+x[1], 7)
		x[13] ^= rot(x[9]+x[5], 9)
		x[1] ^= rot(x[13]+x[9], 13)
		x[5] ^= rot(x[1]+x[13], 18)
		x[14] ^= rot(x[10]+x[6], 7)
		x[2] ^= rot(x[14]+x[10], 9)
		x[6] ^= rot(x[2]+x[14], 13)
		x[10] ^= rot(x[6]+x[2], 18)
		x[3] ^= rot(x[15]+x[11], 7)
		x[7] ^= rot(x[3]+x[15], 9)
		x[11] ^= rot(x[7]+x[3], 13)
		x[15] ^= rot(x[11]+x[7], 18)

		x[1] ^= rot(x[0]+x[3], 7)
		x[2] ^= rot(x[1]+x[0], 9)
		x[3] ^= rot(x[2]+x[1], 13)
		x[0] ^= rot(x[3]+x[2], 18)
		x[6] ^= rot(x[5]+x[4], 7)
		x[7] ^= rot(x[6]+x[5], 9)
		x[4] ^= rot(x[7]+x[6], 13)
		x[5] ^= rot(x[4]+x[7], 18)
		x[11] ^= rot(x[10]+x[9], 7)
		x[8] ^= rot(x[11]+x[10], 9)
		x[9] ^= rot(x[8]+x[11], 13)
		x[10] ^= rot(x[9]+x[8], 18)
		x[12] ^= rot(x[15]+x[14], 7)
		x[13] ^= rot(x[12]+x[15], 9)
		x[14] ^= rot(x[13]+x[12], 13)
		x[15] ^= rot(x[14]+x[13], 18)
	}
	for i := range x {
		x[i] += tmp[i]
		out[i] = x[i]
		tmp[i] = x[i]
	}
}

func blockMix(tmp *[16]uint32, in, out []uint32, r int) {
	copy(tmp[:], in[(2*r-1)*16:])
	for i := 0; i < 2*r; i += 2 {
		salsaXOR(tmp, in[i*16:], out[i*8:])
		salsaXOR(tmp, in[i*16+16:], out[i*8+r*16:])
	}
}

func integerify(b []uint32, r int) uint64 {
	j := (2*r - 1) * 16
	return uint64(b[j]) | uint64(b[j+1])<<32
}

func smix(b []byte, r, N int, v, xy []uint32) {
	var tmp [16]uint32
	R := 32 * r
	x, y := xy[:R], xy[R:]
	for i := 0; i < R; i++ {
		x[i] = binary.LittleEndian.Uint32(b[i*4:])
	}
	for i := 0; i < N; i += 2 {
		copy(v[i*R:], x)
		blockMix(&tmp, x, y, r)
		copy(v[(i+1)*R:], y)
		blockMix(&tmp, y, x, r)
	}
	for i := 0; i < N; i += 2 {
		j := int(integerify(x, r) & uint64(N-1))
		for k := 0; k < R; k++ {
			x[k] ^= v[j*R+k]
		}
		blockMix(&tmp, x, y, r)
		j = int(integerify(y, r) & uint64(N-1))
		for k := 0; k < R; k++ {
			y[k] ^= v[j*R+k]
		}
		blockMix(&tmp, y, x, r)
	}
	for i := 0; i < R; i++ {
		binary.LittleEndian.PutUint32(b[i*4:], x[i])
	}
}

func scryptKey(password, salt []byte, N, r, p, keyLen int) []byte {
	b, err := pbkdf2.Key(sha256.New, string(password), salt, 1, p*128*r)
	if err != nil {
		panic(err)
	}
	xy := make([]uint32, 64*r)
	v := make([]uint32, 32*N*r)
	for i := 0; i < p; i++ {
		smix(b[i*128*r:], r, N, v, xy)
	}
	k, err := pbkdf2.Key(sha256.New, string(password), b, 1, keyLen)
	if err != nil {
		panic(err)
	}
	return k
}
