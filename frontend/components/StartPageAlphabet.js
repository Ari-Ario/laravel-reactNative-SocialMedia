import React, { useEffect, useRef } from 'react';
import { Platform, View, Text, StyleSheet, Animated } from 'react-native';

const alphabets = [
  '𒀀',    // Ancient Sumerian (Cuneiform)
  'A',    // Latin (English, French, etc.)
  'آ',    // Arabic
  'א',    // Hebrew
  'अ',    // Devanagari (Hindi, Marathi, etc.)
  'ა',    // Georgian
  'ก',    // Thai
  'ㄱ',    // Hangul (Korean)
  'あ',    // Hiragana (Japanese)
  '字',    // Chinese (Kanji)
  'ກ',    // Lao
  'ᚠ',    // Futhark (Runic)
  'Ꭰ',    // Cherokee
  'አ',    // Ge'ez (Amharic, Ethiopian languages)
  'ሀ',    // Amharic
  'က',    // Burmese
  'በ',    // Tigrinya
  'ተ',    // Afaan Oromo
  '𐎀',    // Phoenician
  '𐌰',    // Old Italic
  'ᐊ',    // Inuktitut (Canadian Aboriginal Syllabics)
  '𐐀',    // Deseret Alphabet (used in early Mormon script)
  'ⴰ',    // Tifinagh (Berber languages)
  'ა',    // Georgian
  'ᐃ',    // Cree Syllabics
  '𐡀',    // Aramaic
  '𑀅',    // Brahmi
  'ㄅ',    // Bopomofo (Mandarin Phonetic Symbols)
  'ᄀ',    // Hangul (Ancient Korean)
  // '𐤀',    // Paleo-Hebrew
  'Ꮐ',    // Cherokee Syllabary (modern use)
  'ꓕ',    // Garifuna (Latin Script)
  '𑑀'     // Devanagari (Ancient variant)
];



const HomePage = () => {
  const opacityValues = useRef(alphabets.map(() => new Animated.Value(1))).current;

  // Toggle opacity of random letters
  useEffect(() => {
    const toggleOpacity = () => {
      opacityValues.forEach((opacity, index) => {
        const randomOpacity = Math.random() < 0.3 ? 0 : 1;
        Animated.timing(opacity, {
          toValue: randomOpacity,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      });
    };

    const interval = setInterval(toggleOpacity, 400);
    return () => clearInterval(interval);
  }, [opacityValues]);

  return (
    <View style={styles.container}>
      <View style={styles.heroContainer}>
        <View style={styles.heroText}>
          {/* <Text style={styles.subheading}>Explore the world</Text> */}
        </View>

        <View style={styles.matrixContainer}>
          {alphabets.map((char, index) => (
            <Animated.Text
              key={index}
              style={[
                styles.digit,
                {
                  opacity: opacityValues[index],
                  fontSize: Math.random() * 20 + 20,
                },
              ]}
            >
              {char}
            </Animated.Text>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // flex: 1,
    // backgroundColor: '#1c1c1c',
    // opacity: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  heroContainer: {
    alignItems: 'center',
    width: '100%',
  },
  heroText: {
    alignItems: 'center',
    marginBottom: 20,
  },
  heading: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subheading: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  matrixContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // width: '80%',
    justifyContent: 'center',
  },
  digit: {
    margin: 4,
    // color: '#1c1c1c',
  },
});

export default HomePage;